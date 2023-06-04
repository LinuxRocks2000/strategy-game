/*
    LE PROBLEM: There's a sporadic, unpredictable deadlock. We know, since it seems at random, it
    must be related to the time difference between the mainloop and other sections.
    Mainloop locking combinations:
    server + objects
    server + clients
    There are more possibilities if we consider the client iter. We'll go over that later.
*/

#![allow(non_camel_case_types)]
// Warp-based rewrite of the server.
pub mod vector;
pub mod physics;
pub mod gamepiece;
pub mod prng;
use crate::vector::Vector2;
use futures_util::{SinkExt, StreamExt, stream::SplitSink};
use warp::Filter;
use warp::ws::{Message, WebSocket};
use std::vec::Vec;
use tokio::sync::Mutex;
use std::sync::Arc;
use crate::gamepiece::*;
use std::fmt;
use std::f32::consts::PI;
use rand::Rng;
use prng::Mulberry32;
use crate::gamepiece::fighters::*;
use crate::gamepiece::misc::*;

const FPS : f32 = 30.0;


#[derive(PartialEq)]
enum ClientMode {
    None,
    Normal,
    Defense,
    RealTimeFighter
}


pub struct Client {
    tx                : SplitSink<WebSocket, Message>,
    is_authorized     : bool,
    score             : i32,
    has_placed        : bool,
    banner            : usize,
    m_castle          : Option<Arc<Mutex<GamePieceBase>>>,
    do_close          : bool,
    mode              : ClientMode,
    team              : Option<Arc<Mutex<TeamData>>>
}


#[derive(PartialEq, Copy, Clone, Debug)]
enum GameMode {
    Waiting,  // The game hasn't started yet: you can join at this point. Countdown may exist.
    Strategy, // Strategy change
    Play,     // Ships are moving
}

struct TeamData {
    id               : usize,
    banner_id        : usize,
    password         : Arc<String>,
    members          : Vec <Arc<Mutex<Client>>>
}

pub struct Server {
    clients         : Vec<Arc<Mutex<Client>>>,
    mode            : GameMode,
    password        : String,
    objects         : Vec<Arc<Mutex<GamePieceBase>>>,
    teams           : Vec<Arc<Mutex<TeamData>>>,
    banners         : Vec<Arc<String>>,
    gamesize        : u32,
    authenticateds  : u32,
    terrain_seed    : u32,
    top_id          : u32,
    counter         : u32,
    costs           : bool, // Whether or not to cost money when placing a piece
    random          : Arc<Mutex<Mulberry32>>,
    place_timer     : u32,
    autonomous      : Option<(u32, u32, u32, u32)>,
    is_io           : bool // IO mode gets rid of the winner system (game never ends) and allows people to join at any time.
}

enum AuthState {
    Error,
    Single,
    Team (Arc<Mutex<TeamData>>),
    Spectator
}

impl Server {
    fn new_user_can_join(&self) -> bool {
        let mut moidah = self.mode == GameMode::Waiting;
        if self.is_io {
            moidah = true; // Waiting means nothing during io mode.
        }
        if self.autonomous.is_some() {
            moidah = moidah && (self.authenticateds < self.autonomous.unwrap().1);
        }
        return moidah;
    }

    async fn place(&mut self, piece : Arc<Mutex<dyn GamePiece + Send + Sync>>, x : f32, y : f32, a : f32, mut sender : Option<&mut Client>) -> Arc<Mutex<GamePieceBase>> {
        let la_thang = Arc::new(Mutex::new(GamePieceBase::new(piece, x, y, a).await));
        if self.costs && sender.is_some() {
            let cost = la_thang.lock().await.cost().await as i32;
            if cost > sender.as_ref().unwrap().score {
                return la_thang;
            }
            sender.as_mut().unwrap().collect(-cost).await;
        }
        self.add(la_thang.clone(), sender).await;
        la_thang
    }

    async fn place_wall(&mut self, x : f32, y : f32, sender : Option<&mut Client>) {
        self.place(Arc::new(Mutex::new(Wall::new())), x, y, 0.0, sender).await;
    }

    async fn place_castle(&mut self, x : f32, y : f32, is_rtf : bool, sender : Option<&mut Client>) -> Arc<Mutex<GamePieceBase>> {
        self.place(Arc::new(Mutex::new(Castle::new(is_rtf))), x, y, 0.0, sender).await
    }

    async fn place_basic_fighter(&mut self, x : f32, y : f32, a : f32, sender : Option<&mut Client>) -> Arc<Mutex<GamePieceBase>> {
        self.place(Arc::new(Mutex::new(BasicFighter::new())), x, y, a, sender).await
    }

    async fn place_tie_fighter(&mut self, x : f32, y : f32, a : f32, sender : Option<&mut Client>) -> Arc<Mutex<GamePieceBase>> {
        self.place(Arc::new(Mutex::new(TieFighter::new())), x, y, a, sender).await
    }

    async fn place_sniper(&mut self, x : f32, y : f32, a : f32, sender : Option<&mut Client>) -> Arc<Mutex<GamePieceBase>> {
        self.place(Arc::new(Mutex::new(Sniper::new())), x, y, a, sender).await
    }

    async fn place_missile(&mut self, x : f32, y : f32, a : f32, sender : Option<&mut Client>) -> Arc<Mutex<GamePieceBase>> {
        self.place(Arc::new(Mutex::new(Missile::new())), x, y, a, sender).await
    }

    async fn place_turret(&mut self, x : f32, y : f32, a : f32, sender : Option<&mut Client>) -> Arc<Mutex<GamePieceBase>> {
        self.place(Arc::new(Mutex::new(Turret::new())), x, y, a, sender).await
    }

    async fn place_radiation(&mut self, x : f32, y : f32, size : f32, halflife : f32, strength : f32, a : f32, sender : Option<&mut Client>) -> Arc<Mutex<GamePieceBase>> {
        self.place(Arc::new(Mutex::new(Radiation::new(halflife, strength, size, size))), x, y, a, sender).await
    }

    async fn place_nuke(&mut self, x : f32, y : f32, a : f32, sender : Option<&mut Client>) -> Arc<Mutex<GamePieceBase>> {
        self.place(Arc::new(Mutex::new(Nuke::new())), x, y, a, sender).await
    }

    async fn place_fort(&mut self, x : f32, y : f32, a : f32, sender : Option<&mut Client>) -> Arc<Mutex<GamePieceBase>> {
        self.place(Arc::new(Mutex::new(Fort::new())), x, y, a, sender).await
    }

    async fn place_random_rubble(&mut self) { // Drop a random chest or wall (or something else, if I add other things)
        let mut randlock = self.random.lock().await;
        let x : f32 = (randlock.next() % self.gamesize) as f32;
        let y : f32 = (randlock.next() % self.gamesize) as f32;
        let chance = randlock.next() % 100;
        drop(randlock);
        let thing : Arc<Mutex<dyn GamePiece + Send + Sync>> = {
            if chance < 50 {
                Arc::new(Mutex::new(Chest::new()))
            }
            else {
                Arc::new(Mutex::new(Wall::new()))
            }
        };
        for object in &self.objects { // This part is fine
            let lelock = object.lock().await;
            if lelock.identify() == 'c' || lelock.identify() == 'R' {
                if (lelock.physics.cx() - x).abs() < 400.0 && (lelock.physics.cy() - y).abs() < 400.0 {
                    println!("Berakx");
                    return;
                }
            }
        }
        self.place(thing, x, y, 0.0, None).await;
    }

    pub async fn shoot(&mut self, position : Vector2, velocity : Vector2, range : i32, sender : Option<&mut Client>) -> Arc<Mutex<GamePieceBase>> {
        let bullet = self.place(Arc::new(Mutex::new(Bullet::new())), position.x, position.y, 0.0, sender).await;
        let mut lock = bullet.lock().await;
        lock.physics.velocity = velocity;
        lock.ttl = range;
        drop(lock);
        bullet
    }

    async fn get_client_by_banner(&self, banner : usize) -> Option<Arc<Mutex<Client>>> {
        for client in &self.clients {
            if client.lock().await.banner == banner {
                return Some(client.clone());
            }
        }
        None
    }

    async fn deal_with_objects(&mut self) {
        for x in 0..(self.objects.len() - 1) { // Go from first until the next-to-last item, because the inner loop goes from second to last.
            for y in (x + 1)..self.objects.len() {
                if x == y {
                    println!("HANGING BECAUSE X EQUALS Y! CHECK YOUR MATH!");
                }
                let mut x_lockah = self.objects[x].lock().await; // Because of the phase shift these should never be the same item.
                let mut y_lockah = self.objects[y].lock().await;
                let intasectah = x_lockah.physics.shape().intersects(y_lockah.physics.shape());
                if intasectah.0 {
                    if x_lockah.get_does_collide(y_lockah.identify()).await {
                        x_lockah.damage(y_lockah.get_collision_info().damage);
                        if x_lockah.dead() && (y_lockah.get_banner() != x_lockah.get_banner()) {
                            let killah = self.get_client_by_banner(y_lockah.get_banner()).await;
                            if killah.is_some() {
                                let amount = x_lockah.capture().await as i32;
                                killah.unwrap().lock().await.collect(amount).await;
                            }
                        }
                    }
                    if y_lockah.get_does_collide(x_lockah.identify()).await {
                        y_lockah.damage(x_lockah.get_collision_info().damage);
                        if y_lockah.dead() && (y_lockah.get_banner() != x_lockah.get_banner()) {
                            let killah = self.get_client_by_banner(x_lockah.get_banner()).await;
                            if killah.is_some() {
                                let amount = y_lockah.capture().await as i32;
                                killah.unwrap().lock().await.collect(amount).await;
                            }
                        }
                    }
                }
            }
        }
        let mut i : i32 = 0;
        while i < self.objects.len() as i32 {
            let lockah_thang = self.objects[i as usize].clone();
            let mut obj = lockah_thang.lock().await;
            let mut args_vec = vec![obj.get_id().to_string()];
            let phys = obj.get_physics_object();
            if phys.translated() || phys.rotated() || phys.resized() {
                args_vec.push(phys.cx().to_string());
                args_vec.push(phys.cy().to_string());
            }
            if phys.rotated() || phys.resized() {
                args_vec.push(phys.angle().to_string());
            }
            if phys.resized() {
                args_vec.push(phys.width().to_string());
                args_vec.push(phys.height().to_string());
            }
            if args_vec.len() > 1 {
                self.broadcast(ProtocolMessage {
                    command: 'M',
                    args: args_vec
                }, None).await;
            }
            obj.update(self).await;
            // Do death checks a bit late (pun not intended) so objects have a chance to self-rescue.
            if obj.dead() {
                self.objects.remove(i as usize);
                i -= 1;
                obj.die(self).await;
                self.broadcast(ProtocolMessage {
                    command: 'd',
                    args: vec![obj.get_id().to_string()]
                }, None).await;
            }
            i += 1;
        }
    }

    async fn clear_of_banner(&mut self, banner : usize) {
        let mut i : i32 = 0;
        while i < self.objects.len() as i32 {
            let lockah_thang = self.objects[i as usize].clone();
            let obj = lockah_thang.lock().await;
            if obj.get_banner() == banner {
                self.objects.remove(i as usize);
                i -= 1;
                self.broadcast(ProtocolMessage {
                    command: 'd',
                    args: vec![obj.get_id().to_string()]
                }, None).await;
            }
            i += 1;
        }
    }

    async fn mainloop(&mut self) {
        if self.mode == GameMode::Play {
            self.deal_with_objects().await;
            self.place_timer -= 1;
            if self.place_timer <= 0 {
                self.place_timer = self.random.lock().await.next() % 200 + 50;
                self.place_random_rubble().await;
            }
        }
        if self.mode == GameMode::Waiting {
            if self.autonomous.is_some() {
                if self.authenticateds >= self.autonomous.unwrap().0 {
                    self.autonomous.as_mut().unwrap().2 -= 1;
                    self.broadcast(ProtocolMessage {
                        command: '!',
                        args: vec![self.autonomous.unwrap().2.to_string()]
                    }, None).await;
                    if self.autonomous.unwrap().2 <= 0 {
                        self.start().await;
                    }
                }
            }
        }
        else {
            if self.counter > 0 {
                self.counter -= 1;
            }
            else {
                self.flip();
            }
            let mut living = 0;
            let mut winning_player : Option<Arc<Mutex<Client>>> = None;
            let mut living_teams = 0;
            let mut winning_team : Option<Arc<Mutex<TeamData>>> = None;
            let mut is_rtf_game = true;
            for i in 0..self.clients.len() {
                let cli = self.clients[i].clone();
                let mut lockah = cli.lock().await;
                if lockah.m_castle.is_some() && lockah.m_castle.as_ref().unwrap().lock().await.identify() != 'R' {
                    is_rtf_game = false;
                }
                let mut args = vec![self.counter.to_string(), (if self.mode == GameMode::Strategy { "1" } else { "0" }).to_string()];
                if lockah.m_castle.is_some() {
                    args.push((lockah.m_castle.as_ref().unwrap().lock().await.health()).to_string());
                }
                lockah.send_protocol_message(ProtocolMessage {
                    command: 't',
                    args
                }).await;
                if lockah.is_alive().await {
                    living += 1;
                    winning_player = Some(self.clients[i].clone());
                    if lockah.team.is_some() {
                        if !winning_team.is_some() || !Arc::ptr_eq(winning_team.as_ref().unwrap(), lockah.team.as_ref().unwrap()) { // If there's no winning team, or the winning team != the current team, incremeent - you've found a new living team
                            living_teams += 1;
                        }
                        winning_team = Some(lockah.team.as_ref().unwrap().clone());
                    }
                    else { // Unaffiliated players are considered as teams of their own
                        living_teams += 1;
                    }
                }
                else {
                    if lockah.m_castle.is_some() {
                        lockah.m_castle = None;
                        lockah.send_protocol_message(ProtocolMessage {
                            command: 'l',
                            args: vec![]
                        }).await;
                        if self.is_io {
                            let banner = lockah.banner;
                            self.clear_of_banner(banner).await;
                        }
                    }
                }
            }
            if is_rtf_game {
                self.set_mode(GameMode::Play);
            }
            if !self.is_io {
                if living_teams == 0 {
                    println!("GAME ENDS WITH A TIE");
                    self.broadcast(ProtocolMessage {
                        command: 'T',
                        args: vec![]
                    }, None).await;
                    println!("Tie broadcast complete.");
                }
                else if living_teams == 1 { // This will also evaluate true if there's only one player on the field
                    println!("GAME ENDS WITH A WINNER");
                    let winning_banner = if living > 1 {
                        winning_team.as_ref().unwrap().lock().await.banner_id
                    }
                    else {
                        winning_player.as_ref().unwrap().lock().await.send_protocol_message(ProtocolMessage {
                            command: 'W',
                            args: vec![]
                        }).await;
                        winning_player.as_ref().unwrap().lock().await.banner
                    };
                    self.broadcast(ProtocolMessage {
                        command: 'E',
                        args: vec![winning_banner.to_string()]
                    }, None).await;
                    println!("Win broadcast complete.");
                }
                if living_teams < 2 {
                    self.reset().await;
                }
            }
        }
    }

    fn set_mode(&mut self, mode : GameMode) {
        self.counter = match mode {
            GameMode::Waiting => {
                if self.autonomous.is_some() {
                    self.autonomous.as_mut().unwrap().2 = self.autonomous.unwrap().3;
                }
                1.0
            },
            GameMode::Strategy => FPS * 40.0,
            GameMode::Play => FPS * 20.0
        } as u32;
        self.mode = mode;
    }

    fn flip(&mut self) {
        self.set_mode(match self.mode {
            GameMode::Strategy => GameMode::Play,
            GameMode::Play => GameMode::Strategy,
            GameMode::Waiting => GameMode::Waiting
        });
    }

    async fn start(&mut self) {
        if self.mode == GameMode::Waiting {
            for _ in 0..((self.gamesize * self.gamesize) / 1000000) { // One per 1,000,000 square pixels
                self.place_random_rubble().await; // THIS FUNCTION IS AT FAULT!!!!!!!!!!!!!! THE PROBLEM IS HERE!!!!!!!!!!!!! ##########################
            }
            self.set_mode(GameMode::Strategy);
            println!("Game start.");
        }
        else {
            println!("That doesn't work here (not in waiting mode)");
        }
    }

    async fn broadcast<'a>(&'a self, message : ProtocolMessage, mut sender : Option<&'a mut Client>) -> Option<&mut Client> {
        let cloned_clilist = self.clients.clone();
        for client in cloned_clilist {
            let thisun = message.clone();
            if sender.is_some() {
                match client.try_lock() {
                    Ok(mut lock) => {
                        lock.send_protocol_message(thisun).await;
                    },
                    Err(_) => {
                        sender.as_mut().unwrap().send_protocol_message(thisun).await;
                    }
                }
            }
            else {
                client.lock().await.send_protocol_message(thisun).await;
            }
        }
        sender
    }

    async fn add(&mut self, pc : Arc<Mutex<GamePieceBase>>, sender : Option<&mut Client>) {
        let mut piece = pc.lock().await;
        piece.set_id(self.top_id);
        self.top_id += 1;
        if sender.is_some() {
            piece.set_banner(sender.as_ref().unwrap().banner);
        }
        let mut sendoo = self.broadcast(piece.get_new_message().await, sender).await;
        if sendoo.is_some(){
            piece.set_banner(sendoo.as_ref().unwrap().banner);
            sendoo.as_mut().unwrap().send_protocol_message(ProtocolMessage {
                command: 'a',
                args: vec![piece.get_id().to_string()]
            }).await;
        }
        self.objects.push(pc.clone());
    }

    async fn authenticate(&self, password : String) -> AuthState {
        if password == "" {
            return AuthState::Spectator;
        }
        else if self.password == password {
            return AuthState::Single;
        }
        else {
            for team in &self.teams {
                let lock = team.lock().await;
                let is_allowed : bool = password == *lock.password;
                drop(lock);
                if is_allowed {
                    return AuthState::Team (team.clone());
                }
            }
        }
        return AuthState::Error;
    }

    async fn banner_add(&mut self, mut dispatcha : Option<&mut Client>, banner : Arc<String>) -> usize {
        let bannah = self.banners.len();
        let mut args = vec![bannah.to_string(), banner.to_string()];
        if dispatcha.is_some() {
            dispatcha.as_mut().unwrap().banner = self.banners.len();
            if dispatcha.as_ref().unwrap().team.is_some() {
                args.push(dispatcha.as_ref().unwrap().team.as_ref().unwrap().lock().await.banner_id.to_string());
            }
        }
        self.banners.push(banner.clone());
        let message = ProtocolMessage {
            command: 'b',
            args
        };
        self.broadcast(message, dispatcha).await;
        bannah
    }

    async fn get_team_of_banner(&self, banner : usize, mut sender : Option<&mut Client>) -> Option<Arc<Mutex<TeamData>>> {
        for lock in &self.clients {
            match lock.try_lock() {
                Ok(client) => {
                    if client.banner == banner && client.team.is_some() {
                        return Some(client.team.as_ref().unwrap().clone());
                    }
                },
                Err(_) => {
                    let client = sender.as_mut().unwrap();
                    if client.banner == banner && client.team.is_some() {
                        return Some(client.team.as_ref().unwrap().clone());
                    }
                }
            }
        }
        None
    }

    async fn metadata(&mut self, user : &mut Client) {
        user.send_protocol_message(ProtocolMessage {
            command: 'm',
            args: vec![self.gamesize.to_string(), self.terrain_seed.to_string()]
        }).await;
        for index in 0..self.banners.len() {
            let banner = &self.banners[index];
            let team = self.get_team_of_banner(index, Some(user)).await;
            let mut args = vec![index.to_string(), banner.to_string()];
            if team.is_some(){
                args.push(team.unwrap().lock().await.banner_id.to_string());
            }
            user.send_protocol_message(ProtocolMessage {
                command: 'b',
                args
            }).await;
        }
        for piece in &self.objects {
            user.send_protocol_message(piece.lock().await.get_new_message().await).await;
        }
    }

    async fn user_logged_in(&mut self, user : &mut Client) {
        self.authenticateds += 1;
        self.metadata(user).await;
    }

    async fn spectator_joined(&mut self, user : &mut Client) {
        self.metadata(user).await;
    }

    async fn reset(&mut self) {
        println!("############## RESETTING ##############");
        while self.clients.len() > 0 {
            self.clients[0].lock().await.do_close = true;
            self.clients.remove(0);
        }
        while self.objects.len() > 0 {
            self.objects.remove(0);
        }
        self.set_mode(GameMode::Waiting);
        while self.banners.len() > 0 {
            self.banners.remove(0);
        }
    }
}


#[derive(Clone)]
pub struct ProtocolMessage {
    command : char,
    args    : Vec<String>
}


impl ProtocolMessage {
    fn parse_string(message : String) -> Option<Self> {
        let characters : Vec<char> = message.chars().collect();
        let command = characters[0];
        let mut args = vec![];
        let mut buffer : String = String::new();
        let mut i = 1;
        while i < characters.len() {
            let arg_end : u32 = i as u32 + characters[i] as u32;
            if arg_end >= characters.len() as u32{
                println!("[ WARNING ] Some idiot is trying to broadcast poison frames!");
                return None;
            }
            while i < arg_end as usize {
                i += 1;
                buffer.push(characters[i]);
            }
            i += 1;
            args.push(buffer.clone());
            buffer.clear();
        }
        Some(Self {
            command, args
        })
    }

    fn encode(&self) -> String {
        let mut r = String::new();
        r.push(self.command);
        for arg in &self.args {
            r.push(char::from_u32(arg.len() as u32).unwrap());
            r += &arg;
        }
        r
    }

    fn poison(&self, problem : &str) {
        println!("The client is poisoning us with {} ({})", self, problem);
    }
}


impl fmt::Display for ProtocolMessage {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let mut thang = String::new();
        thang.push(self.command);
        thang += " with [";
        for arg in &self.args {
            thang += &arg;
            thang += ", ";
        }
        thang += "]";
        write!(f, "{}", thang)
    }
}


impl Client {
    fn new(tx : SplitSink<WebSocket, Message>) -> Self {
        Self {
            tx,
            is_authorized: false,
            score: 0,
            has_placed: false,
            banner: 0,
            m_castle: None,
            do_close: false,
            mode: ClientMode::None,
            team: None
        }
    }

    async fn send_text(&mut self, text : &str) {
        self.tx.send(Message::text(text)).await.expect("WHOOPS! COULDN'T SEND!");
    }

    async fn collect(&mut self, amount : i32) {
        self.score += amount;
        self.send_protocol_message(ProtocolMessage {
            command: 'S',
            args: vec![self.score.to_string()]
        }).await;
    }

    async fn send_protocol_message(&mut self, message : ProtocolMessage) {
        self.send_text(&(message.encode())).await;
    }

    async fn send_error(&mut self, error : u32) {
        self.send_protocol_message(ProtocolMessage {
            command: 'e',
            args: vec![error.to_string()]
        }).await;
    }

    async fn send_warning(&mut self, warning : u32) {
        self.send_protocol_message(ProtocolMessage {
            command: 'w',
            args: vec![warning.to_string()]
        }).await;
    }

    async fn send_singlet(&mut self, thing : char) {
        self.send_protocol_message(ProtocolMessage {
            command: thing,
            args: vec![]
        }).await;
    }

    async fn handle(&mut self, message : ProtocolMessage, mut server : tokio::sync::MutexGuard<'_, Server>) {
        if message.command == 'c' && !self.is_authorized {
            if server.new_user_can_join() {
                let lockah = server.authenticate(message.args[0].clone()).await;
                match lockah { // If you condense this, for === RUST REASONS === it keeps the mutex locked.
                    AuthState::Error => {
                        println!("New user has invalid password!");
                        self.send_error(0).await;
                        return;
                    },
                    AuthState::Single => {
                        println!("New user has authenticated as single player");
                        self.send_singlet('s').await;
                        server.user_logged_in(self).await;
                        server.banner_add(Some(self), Arc::new(message.args[1].clone())).await;
                    },
                    AuthState::Team (team) => {
                        println!("New user has authenticated as player in team {}", server.banners[team.lock().await.banner_id]);
                        self.team = Some(team.clone());
                        self.send_singlet('s').await;
                        server.user_logged_in(self).await;
                        server.banner_add(Some(self), Arc::new(message.args[1].clone())).await;
                    },
                    AuthState::Spectator => {
                        println!("Spectator joined!");
                        self.send_warning(0).await;
                        server.spectator_joined(self).await;
                    }
                }
                self.is_authorized = true;
                self.mode = match message.args[2].as_str() {
                    "normal" => ClientMode::Normal,
                    "defender" => ClientMode::Defense,
                    "rtf" => ClientMode::RealTimeFighter,
                    _ => ClientMode::Normal
                };
            }
            else {
                println!("New user can't join!");
                self.send_warning(0).await;
                server.spectator_joined(self).await;
            }
        }
        else if self.is_authorized {
            match message.command {
                'p' => {
                    if message.args.len() == 3 {
                        let tp = &message.args[0];
                        let x = message.args[1].parse::<f32>();
                        let y = message.args[2].parse::<f32>();
                        if x.is_ok() && y.is_ok(){
                            let x = x.unwrap();
                            let y = y.unwrap();
                            match tp.as_str() {
                                "c" => {
                                    if !self.has_placed {
                                        self.has_placed = true;
                                        server.costs = false;
                                        self.m_castle = Some(server.place_castle(x, y, self.mode == ClientMode::RealTimeFighter, Some(self)).await);
                                        match self.mode {
                                            ClientMode::Normal => {
                                                server.place_basic_fighter(x - 200.0, y, PI, Some(self)).await;
                                                server.place_basic_fighter(x + 200.0, y, 0.0, Some(self)).await;
                                                server.place_basic_fighter(x, y - 200.0, 0.0, Some(self)).await;
                                                server.place_basic_fighter(x, y + 200.0, 0.0, Some(self)).await;
                                                self.collect(50).await;
                                            },
                                            ClientMode::RealTimeFighter => {
                                                server.place_basic_fighter(x - 100.0, y, PI, Some(self)).await;
                                                server.place_basic_fighter(x + 100.0, y, 0.0, Some(self)).await;
                                            },
                                            ClientMode::Defense => {
                                                server.place_basic_fighter(x - 200.0, y, PI, Some(self)).await;
                                                server.place_basic_fighter(x + 200.0, y, 0.0, Some(self)).await;
                                                server.place_turret(x, y - 200.0, 0.0, Some(self)).await;
                                                server.place_turret(x, y + 200.0, 0.0, Some(self)).await;
                                                self.collect(25).await;
                                            },
                                            _ => {

                                            }
                                        }
                                        server.costs = true;
                                    }
                                    else {
                                        message.poison("MULTIPLE CASTLE PLACE ATTEMPTS");
                                    }
                                },
                                "f" => {
                                    server.place_basic_fighter(x, y, 0.0, Some(self)).await;
                                },
                                "w" => {
                                    server.place_wall(x, y, Some(self)).await;
                                },
                                "t" => {
                                    server.place_tie_fighter(x, y, 0.0, Some(self)).await;
                                },
                                "s" => {
                                    server.place_sniper(x, y, 0.0, Some(self)).await;
                                },
                                "h" => {
                                    server.place_missile(x, y, 0.0, Some(self)).await;
                                },
                                "T" => {
                                    server.place_turret(x, y, 0.0, Some(self)).await;
                                },
                                "n" => {
                                    server.place_nuke(x, y, 0.0, Some(self)).await;
                                },
                                "F" => {
                                    let fort = server.place_fort(x, y, 0.0, Some(self)).await;
                                    if self.m_castle.is_some() {
                                        self.m_castle.as_mut().unwrap().lock().await.add_fort(fort);
                                    }
                                },
                                &_ => {
                                    message.poison("INVALID PLACE TYPE");
                                }
                            };
                        }
                        else {
                            message.poison("INVALID INTEGERS");
                        }
                    }
                    else {
                        message.poison("INVALID ARGUMENT LENGTH");
                    }
                },
                'C' => {
                    let mut amount = match message.args[0].parse::<i32>() {
                        Ok(numbah) => numbah,
                        Err(_) => {
                            message.poison("INVALID INTEGERS");
                            0
                        }
                    };
                    amount = amount.abs();
                    self.collect(-amount).await;
                },
                'm' => {
                    let id = match message.args[0].parse::<u32>() {
                        Ok(numbah) => numbah,
                        Err(_) => {
                            message.poison("INVALID INTEGERS");
                            return;
                        }
                    };
                    let x = match message.args[1].parse::<f32>() {
                        Ok(numbah) => numbah,
                        Err(_) => {
                            message.poison("INVALID INTEGERS");
                            return;
                        }
                    };
                    let y = match message.args[2].parse::<f32>() {
                        Ok(numbah) => numbah,
                        Err(_) => {
                            message.poison("INVALID INTEGERS");
                            return;
                        }
                    };
                    let a = match message.args[3].parse::<f32>() {
                        Ok(numbah) => numbah,
                        Err(_) => {
                            message.poison("INVALID INTEGERS");
                            return;
                        }
                    };
                    for object in &server.objects {
                        let mut lock = object.lock().await;
                        if lock.get_id() == id {
                            lock.goal_x = x;
                            lock.goal_y = y;
                            lock.goal_a = a;
                        }
                    }
                },
                'R' => {
                    if server.mode == GameMode::Play && self.m_castle.is_some(){
                        let le_castle = self.m_castle.as_mut().unwrap().clone();
                        let mut castle = le_castle.lock().await;
                        let mut thrust = 0.0;
                        let mut resistance = 1.0;
                        let mut angle_thrust = 0.0;
                        if message.args[0] == "1" { // THRUST
                            thrust = 2.0;
                        }
                        if message.args[1] == "1" { // TURN LEFT
                            angle_thrust -= 0.02;
                        }
                        if message.args[2] == "1" { // TURN RIGHT
                            angle_thrust += 0.02;
                        }
                        if message.args[3] == "1" { // AIRBRAKE
                            resistance = 0.8;
                        }
                        castle.shooter_properties.suppress = !(message.args[4] == "1");
                        let thrust = Vector2::new_from_manda(thrust, castle.physics.angle() - PI/2.0);
                        castle.physics.velocity += thrust;
                        castle.physics.velocity *= resistance;
                        castle.physics.angle_v += angle_thrust;
                        castle.physics.angle_v *= 0.9;
                        if castle.physics.velocity.magnitude() > 20.0 {
                            castle.physics.velocity.set_magnitude(20.0);
                        }
                    }
                },
                'U' => {
                    // Upgrade.
                    if message.args.len() != 2 {
                        message.poison("INVALID ARGUMENT LENGTH");
                    }
                    let id = match message.args[0].parse::<u32>() {
                        Ok(id) => id,
                        Err(_) => {
                            message.poison("INVALID ID");
                            return;
                        }
                    };
                    let upg = message.args[1].clone();
                    for object in &server.objects {
                        let mut lawk = object.lock().await;
                        if lawk.get_id() == id {
                            lawk.upgrade(upg).await;
                            break;
                        }
                    }
                    server.broadcast(ProtocolMessage {
                        command: 'u',
                        args: vec![id.to_string(), message.args[1].clone()]
                    }, Some(self)).await;
                }
                _ => {
                    message.poison("INAPPROPRIATE COMMAND");
                }
            }
        }
        else {
            message.poison("INVALID COMMAND");
        }
    }

    fn close(&self) {
        println!("Client close routine!");
    }

    async fn is_alive(&self) -> bool {
        if self.m_castle.is_some() {
            if !(self.m_castle.as_ref().unwrap().lock().await.dead()) {
                return true;
            }
        }
        false
    }
}


async fn got_client(websocket : WebSocket, server : Arc<Mutex<Server>>){
    let (tx, mut rx) = websocket.split();
    let moi = Arc::new(Mutex::new(Client::new(tx)));
    server.lock().await.clients.push(moi.clone());
    while let Some(result) = rx.next().await {
        let serverlock = server.lock().await; // Lock the server before locking the client. This is the only way to ensure that both client and server aren't in use at the time and that the server can be safely used.
        let mut morlock = moi.lock().await;
        let msg = match result {
            Ok(msg) => msg,
            Err(e) => {
                println!("UH NOES! A SOCKET BORKY HAPPENDY! POOPLES! {e}");
                break;
            }
        };
        if msg.is_text(){ // THE DEADLOCK IS IN HERE SOMEWHERE
            let text = match msg.to_str() {
                Ok(text) => text,
                Err(()) => ""
            };
            if text == "_"{
                morlock.send_text("_").await;
            }
            else {
                let p = ProtocolMessage::parse_string(text.to_string());
                if p.is_some() {
                    morlock.handle(p.unwrap() /* If it made it this far, there's data to unwrap */, serverlock).await; // IT'S IN HERE SOMEWHERE
                    // Deadlock condition found. An unlocked server will run mainloop *while this is called*, and because this (fails to) lock the server it can never exit. This means the client mutex is never unlocked.
                }
            }
        }
        if morlock.do_close {
            break;
        }
    }
    let morlock = moi.lock().await;
    let mut serverlock = server.lock().await;
    morlock.close();
    if morlock.team.is_some(){ // Remove us from the team
        let mut teamlock = morlock.team.as_ref().unwrap().lock().await;
        let mut i = 0;
        while i < teamlock.members.len() {
            if Arc::ptr_eq(&teamlock.members[i], &moi) {
                teamlock.members.remove(i);
                break;
            }
            i += 1;
        }
    }
    if !morlock.do_close { // If it's not been force-closed by the server (which handles closing if force-close happens)
        let index = serverlock.clients.iter().position(|x| Arc::ptr_eq(x, &moi)).unwrap();
        serverlock.clients.remove(index);
    }
    if morlock.is_authorized {
        serverlock.authenticateds -= 1;
    }
    if serverlock.is_io {
        serverlock.clear_of_banner(morlock.banner).await;
    }
    println!("Dropped client");
}

//
//
//============[]             \       /   
//============[]  0      0   _|     |_
//============[]--0------0--/ _   _   \
//============[]------0-----|   _   _ |
//============[]      0      \_______/
//============[]
//
//
// YOU'VE BEEN PWNED by a VENUS FIRETRAP LV. 3
// Your spells: Extinguish lv. 1, air blast lv. 2
// HP: -1 of 8; XP: 80; LV: 2;
// YOU ARE DEAD! INSERT A COIN TO CONTINUE!

fn input(prompt: &str) -> String {
    use std::io;
    use std::io::{BufRead, Write};
    print!("{}", prompt);
    io::stdout().flush().expect("Input failed!");
    io::stdin()
        .lock()
        .lines()
        .next()
        .unwrap()
        .map(|x| x.trim_end().to_owned()).expect("Input failed!")
}


#[derive(Debug)]
enum ServerCommand {
    Start,
    Flip,
    IoModeToggle,
    Autonomous (u32, u32, u32),
    TeamNew (Arc<String>, Arc<String>),
}


#[tokio::main]
async fn main(){
    use tokio::sync::mpsc::error::TryRecvError;
    let mut rng = rand::thread_rng();
    let server = Server {
        clients             : vec![],
        mode                : GameMode::Waiting,
        password            : input("Game password: "),
        objects             : vec![],
        teams               : vec![],
        gamesize            : 5000,
        authenticateds      : 0,
        terrain_seed        : rng.gen(),
        banners             : vec![Arc::new("None".to_string())],
        top_id              : 0,
        counter             : 1,
        costs               : true,
        random              : Arc::new(Mutex::new(Mulberry32::new(rng.gen()))),
        place_timer         : 100,
        autonomous          : None,
        is_io               : false
    };
    println!("Started server with password {}, terrain seed {}", server.password, server.terrain_seed);
    let server_mutex = Arc::new(Mutex::new(server));
    let server_mutex_loopah = server_mutex.clone();
    let (commandset, mut commandget) = tokio::sync::mpsc::channel(32); // fancy number
    tokio::task::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_millis((1000.0/FPS) as u64));
        loop {
            interval.tick().await;
            let mut lawk = server_mutex_loopah.lock().await; // Tracking le deadlock: It *always*, invariably, hangs here. It never makes it inside the mainloop. Thus the problem cannot be directly related to the mainloop.
            lawk.mainloop().await;
            match commandget.try_recv() {
                Ok (ServerCommand::Start) => {
                    lawk.start().await;
                },
                Ok (ServerCommand::Flip) => {
                    lawk.flip();
                },
                Ok (ServerCommand::TeamNew (name, password)) => {
                    let banner = lawk.banner_add(None, name).await;
                    let id = lawk.teams.len();
                    lawk.teams.push(Arc::new(Mutex::new(TeamData {
                        id,
                        banner_id: banner,
                        password,
                        members: vec![]
                    })));
                },
                Ok (ServerCommand::Autonomous (min_players, max_players, auto_timeout)) => {
                    lawk.autonomous = Some((min_players, max_players, auto_timeout, auto_timeout));
                },
                Ok (ServerCommand::IoModeToggle) => {
                    lawk.is_io = !lawk.is_io;
                    println!("Set io mode to {}", lawk.is_io);
                },
                Err (TryRecvError::Disconnected) => {
                    println!("The channel handling server control was disconnected!");
                },
                Err (TryRecvError::Empty) => {} // Do nothing; we expect it to be empty quite often.
            }
        }
    });

    tokio::task::spawn(async move {
        loop {
            let command = input("");
            let to_send = match command.as_str() {
                "start" => { // Notes: starting causes the deadlock, but flipping doesn't, so the problem isn't merely locking/unlocking.
                    ServerCommand::Start
                },
                "flip" => {
                    println!("Flipping stage");
                    ServerCommand::Flip
                },
                "team new" => {
                    let name = Arc::new(input("Team name: "));
                    let password = Arc::new(input("Team password: "));
                    ServerCommand::TeamNew(name, password)
                },
                "toggle iomode" => {
                    ServerCommand::IoModeToggle
                },
                "autonomous" => {
                    let min_players = match input("Minimum player count to start: ").parse::<u32>() {
                        Ok(num) => num,
                        Err(_) => {
                            println!("Invalid number.");
                            continue;
                        }
                    };
                    let max_players = match input("Maximum player count: ").parse::<u32>() {
                        Ok(num) => num,
                        Err(_) => {
                            println!("Invalid number.");
                            continue;
                        }
                    };
                    let auto_timeout = match input("Timer: ").parse::<u32>() {
                        Ok(num) => num,
                        Err(_) => {
                            println!("Invalid number.");
                            continue;
                        }
                    };
                    ServerCommand::Autonomous (min_players, max_players, auto_timeout)
                },
                _ => {
                    println!("Invalid command.");
                    continue;
                }
            };
            commandset.send(to_send).await.expect("OOOOOOPS");
        }
    });

    let servah = warp::any().map(move || server_mutex.clone());
    let websocket = warp::path("game")
        .and(warp::ws())
        .and(servah)
        .map(|ws : warp::ws::Ws, servah| {
            ws.on_upgrade(move |websocket| got_client(websocket, servah))
        });
    let stat = warp::any()
        .and(warp::fs::dir("../"));
    
    let routes = stat.or(websocket);

    warp::serve(routes).run(([0, 0, 0, 0], 3000)).await;
}