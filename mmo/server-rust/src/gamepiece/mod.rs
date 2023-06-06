// Gamepiece code
use crate::physics::*;
use crate::ProtocolMessage;
use crate::Server;
use std::f32::consts::PI;
use crate::vector::Vector2;
pub mod fighters;
pub mod misc;


pub struct ShooterProperties {
    shoot         : bool,
    counter       : u32,
    angles        : Vec<f32>,
    range         : i32,
    pub suppress  : bool // It can't shoot if this is on, but it can count down.
}


pub enum TargetingFilter {
    Any,
    Fighters
}


#[derive(PartialEq)]
pub enum TargetingMode {
    None,
    Nearest
}


pub struct Targeting {
    mode      : TargetingMode,
    filter    : TargetingFilter,
    range     : (f32, f32),
    vector_to : Option<Vector2>
}


pub enum ExplosionMode {
    None,
    Radiation(f32, f32, f32)
}


fn coterminal<T: Copy + std::ops::Add<U, Output=T> + std::ops::Sub<U, Output=T> + std::cmp::PartialOrd<U>, U: Copy + std::cmp::PartialOrd<T> + std::ops::Sub<U, Output=U>>(mut thing : T, round : U) -> T {
    while thing < (round - round) {
        thing = thing + round;
    }
    while thing > round {
        thing = thing - round;
    }
    thing
}


pub trait GamePiece {
    fn construct<'a>(&'a self, thing : &'a mut GamePieceBase) -> &mut GamePieceBase {
        thing
    }

    fn identify(&self) -> char;

    fn obtain_physics(&self) -> PhysicsObject;

    fn on_die(&mut self) {

    }
    
    fn is_editable(&self) -> bool {
        false
    }

    fn get_does_collide(&self, _id : char) -> bool {
        true
    }

    fn update(&mut self, _master : &mut GamePieceBase, _servah : &mut Server) {
        
    }

    fn cost(&self) -> u32 {
        0
    }

    fn capture(&self) -> u32 {
        std::cmp::min(((self.cost() * 3) / 2) as u32, 75) // The most you can score on any capture is, by default, 75
    }

    fn on_upgrade(&mut self, _master : &mut GamePieceBase, _upgrade : Arc<String>) {

    }
}


#[derive(Copy, Clone)]
pub struct CollisionInfo {
    pub damage : f32, // Damage done constantly to any objects colliding with this object
}

pub struct GamePieceBase {
    max_health             : f32,
    health                 : f32,
    banner                 : usize,
    id                     : u32,
    collision_info         : CollisionInfo,
    value                  : char,
    piece                  : Arc<Mutex<dyn GamePiece + Send + Sync>>,
    pub physics            : PhysicsObject,
    pub goal_x             : f32,
    pub goal_y             : f32,
    pub goal_a             : f32,
    pub shoot_timer        : u32,
    pub shooter_properties : ShooterProperties,
    pub ttl                : i32, // ttl of < 0 means ttl does nothing. ttl of 0 means die. ttl of anything higher means subtract one every update.
    pub targeting          : Targeting,
    broadcasts             : Vec<ProtocolMessage>,
    exploder               : Vec<ExplosionMode>,
    forts                  : Vec<Arc<Mutex<GamePieceBase>>>,
    upgrades               : Vec<Arc<String>>
}

use tokio::sync::Mutex;
use std::sync::Arc;

impl GamePieceBase {
    pub async fn new(piece : Arc<Mutex<dyn GamePiece + Send + Sync>>, x : f32, y : f32, a : f32) -> Self {
        let mut physics = piece.lock().await.obtain_physics(); // Get configured physics and shape
        physics.set_cx(x); // Set the position, because the shape don't get to decide that (yet)
        physics.set_cy(y);
        physics.set_angle(a);
        let mut thing = Self {
            health : 1.0,
            banner : 0,
            id : 0,
            collision_info : CollisionInfo {
                damage : 1.0
            },
            value : piece.lock().await.identify(),
            goal_a : physics.angle(),
            physics,
            piece : piece.clone(),
            goal_x : x,
            goal_y : y,
            shoot_timer : 20,
            shooter_properties : ShooterProperties {
                shoot : false,
                counter : 2000000,
                angles : vec![0.0],
                range : 30,
                suppress : false
            },
            ttl : -1,
            targeting : Targeting {
                mode : TargetingMode::None,
                filter : TargetingFilter::Any,
                range : (0.0, 0.0),
                vector_to : None
            },
            broadcasts : vec![],
            exploder : vec![],
            forts : vec![],
            max_health : 1.0,
            upgrades : vec![]
        };
        piece.lock().await.construct(&mut thing);
        thing.health = thing.max_health;
        thing
    }

    pub fn identify(&self) -> char {
        self.value
    }

    pub async fn is_editable(&self) -> bool {
        self.piece.lock().await.is_editable()
    }

    pub fn murder(&mut self) {
        self.health = 0.0;
    }

    pub async fn target(&mut self, server : &mut Server) {
        let mut best : Option<Arc<Mutex<GamePieceBase>>> = None;
        let mut best_value : f32 = 0.0; // If best is None, this value is ignored, so it can be anything.
        // The goal here is to compare the entire list of objects by some easily derived numerical component,
        // based on a set of options stored in targeting, and set the values in targeting based on that.
        // NOTE: the comparison is *always* <; if you want to compare > values multiply by negative 1.
        for locked in &server.objects {
            match locked.try_lock() {
                Ok(object) => {
                    if object.get_banner() == self.get_banner() { // If you're under the same flag, skip.
                        continue;
                    }
                    let viable = match self.targeting.filter {
                        TargetingFilter::Any => {
                            true
                        },
                        TargetingFilter::Fighters => {
                            match object.identify() {
                                'f' | 'h' | 'R' | 't' | 's' => {
                                    true
                                },
                                _ => {
                                    false
                                }
                            }
                        }
                    };
                    if viable {
                        let val = match self.targeting.mode {
                            TargetingMode::Nearest => {
                                let dist = (object.physics.vector_position() - self.physics.vector_position()).magnitude();
                                if dist >= self.targeting.range.0 && dist <= self.targeting.range.1 {
                                    Some(dist)
                                }
                                else {
                                    None
                                }
                            },
                            TargetingMode::None => None
                        };
                        if val.is_some() {
                            if val.unwrap() < best_value || !best.is_some() {
                                best_value = val.unwrap();
                                best = Some(locked.clone());
                            }
                        }
                    }
                },
                Err(_) => {
                    // It's us, so don't worry about it: do nothing.
                }
            }
        }
        if best.is_some() {
            self.targeting.vector_to = Some(best.unwrap().lock().await.physics.vector_position() - self.physics.vector_position());
        }
        else {
            self.targeting.vector_to = None;
        }
    }

    pub fn broadcast(&mut self, message : ProtocolMessage) {
        self.broadcasts.push(message);
    }

    pub async fn update(&mut self, server : &mut Server) {
        let mut i : usize = 0;
        while i < self.forts.len() {
            if self.forts[i].lock().await.dead() {
                self.forts.remove(i);
                continue; // Don't allow i to increment
            }
            i += 1;
        }
        if self.health <= 0.0 && self.forts.len() > 0 { // DEADLOCK CONDITION: the fort is circularly linked. Unlikely.
            let fortex = self.forts.remove(0); // pop out the oldest fort in the list
            let mut fort = fortex.lock().await;
            fort.health = -1.0; // kill the fort
            self.health = self.max_health; // Restore to maximum health.
            self.physics.set_cx(fort.physics.cx());
            self.physics.set_cy(fort.physics.cy());
            return; // Don't die yet! You have a fort!
        }
        if self.targeting.mode != TargetingMode::None {
            self.target(server).await;
        }
        self.physics.update();
        let clone = self.piece.clone();
        let mut lock = clone.lock().await;
        lock.update(self, server);
        if self.shooter_properties.shoot {
            if self.shooter_properties.suppress {
                if self.shoot_timer > 0 {
                    self.shoot_timer -= 1;
                }
            }
            else {
                self.shawty(self.shooter_properties.range, server).await;
            }
        }
        if self.ttl > 0 {
            self.ttl -= 1;
        }
        else if self.ttl == 0 {
            self.health = 0.0;
        }
        while self.broadcasts.len() > 0 {
            server.broadcast(self.broadcasts.remove(0), None).await;
        }
    }

    pub async fn shawty(&mut self, range : i32, server : &mut Server) {
        if self.shoot_timer == 0 {
            self.shoot_timer = self.shooter_properties.counter;
            for angle in &self.shooter_properties.angles {
                server.shoot(self.physics.extend_point(50.0, *angle), Vector2::new_from_manda(20.0, self.physics.angle() + *angle) + self.physics.velocity, range, None).await
                .lock().await.set_banner(self.banner); // Set the banner
            }
        }
        else {
            self.shoot_timer -= 1;
        }
    }

    pub fn health(&self) -> f32 {
        self.health
    }

    pub fn damage(&mut self, harm : f32) {
        self.health -= harm;
    }
    
    pub fn dead(&self) -> bool {
        self.health <= 0.0 && self.forts.len() == 0
    }

    pub async fn die(&mut self, server : &mut Server) {
        self.piece.lock().await.on_die();
        for explosion in &self.exploder {
            match explosion {
                ExplosionMode::Radiation(size, halflife, strength) => {
                    server.place_radiation(self.physics.cx(), self.physics.cy(), *size, *halflife, *strength, self.physics.angle(), None).await;
                },
                _ => {

                }
            }
        }
    }

    pub async fn get_does_collide(&self, id : char) -> bool {
        self.piece.lock().await.get_does_collide(id)
    }

    pub fn get_physics_object(&mut self) -> &mut PhysicsObject {
        &mut self.physics
    }

    pub fn get_collision_info(&self) -> CollisionInfo {
        self.collision_info
    }

    pub async fn get_new_message(&self) -> ProtocolMessage {
        let mut args = vec![
            self.identify().to_string(),
            self.get_id().to_string(),
            self.physics.cx().to_string(),
            self.physics.cy().to_string(),
            self.physics.angle().to_string(),
            (if self.is_editable().await { 1 } else { 0 }).to_string(),
            self.get_banner().to_string(),
            self.physics.width().to_string(),
            self.physics.height().to_string()
        ];
        for upg in &self.upgrades {
            args.push(String::clone(&upg));
        }
        ProtocolMessage {
            command: 'n',
            args
        }
    }

    pub fn get_banner(&self) -> usize {
        self.banner
    }

    pub fn set_banner(&mut self, new : usize) {
        self.banner = new;
    }

    pub fn set_id(&mut self, id : u32) {
        self.id = id;
    }

    pub fn get_id(&self) -> u32 {
        self.id
    }

    pub async fn cost(&self) -> u32 {
        self.piece.lock().await.cost()
    }

    pub async fn capture(&self) -> u32 {
        self.piece.lock().await.capture()
    }

    pub fn add_fort(&mut self, fort : Arc<Mutex<GamePieceBase>>) {
        self.forts.push(fort);
    }

    pub fn get_max_health(&self) -> f32 {
        self.max_health
    }

    pub async fn upgrade(&mut self, up : String) {
        let up = Arc::new(up);
        let clown = self.piece.clone();
        let mut lawk = clown.lock().await;
        lawk.on_upgrade(self, up.clone());
        self.upgrades.push(up.clone());
    }
}


pub struct Castle {
    is_rtf : bool
}
pub struct Fort {}


impl Castle {
    pub fn new(is_rtf : bool) -> Self {
        Self {
            is_rtf
        }
    }
}

impl Fort {
    pub fn new() -> Self {
        Self {}
    }
}


impl GamePiece for Castle {
    fn obtain_physics(&self) -> PhysicsObject {
        if self.is_rtf {
            PhysicsObject::new(0.0, 0.0, 10.0, 60.0, 0.0)
        }
        else{
            PhysicsObject::new(0.0, 0.0, 50.0, 50.0, 0.0)
        }
    }

    fn construct<'a>(&'a self, thing : &'a mut GamePieceBase) -> &mut GamePieceBase {
        thing.max_health = 3.0;
        if self.is_rtf {
            thing.shooter_properties.counter = 15;
            thing.shooter_properties.shoot = true;
            thing.shooter_properties.angles[0] = -PI/2.0;
        }
        thing
    }

    fn update(&mut self, master : &mut GamePieceBase, server : &mut Server) {
        master.physics.set_cx(coterminal(master.physics.cx(), server.gamesize as f32));
        master.physics.set_cy(coterminal(master.physics.cy(), server.gamesize as f32));
        if master.health < master.max_health {
            master.health += 0.002;
        }
    }

    fn identify(&self) -> char {
        if self.is_rtf { 'R' } else { 'c' }
    }

    fn get_does_collide(&self, id : char) -> bool {
        if self.is_rtf {
            id != 'c' // The only thing RTFs don't collide with is castles. After all, they *are* a type of fighter.
        }
        else {
            id == 'b' || id == 'r' // All they collide with is bullets and radiation.
        }
    }

    fn capture(&self) -> u32 {
        50
    }

    fn on_upgrade(&mut self, master : &mut GamePieceBase, upgrade : Arc<String>) {
        match upgrade.as_str() {
            "b" => { // shot counter speed
                master.shooter_properties.counter = 10;
            },
            &_ => {
                
            }
        }
    }
}

impl GamePiece for Fort {
    fn identify(&self) -> char {
        'F'
    }

    fn obtain_physics(&self) -> PhysicsObject {
        PhysicsObject::new(0.0, 0.0, 10.0, 10.0, 0.0)
    }

    fn cost(&self) -> u32 {
        120
    }
}
