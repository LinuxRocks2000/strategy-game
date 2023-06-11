use serde::{Deserialize, Serialize};
use crate::Server;
use crate::input;

#[derive(Serialize, Deserialize)]
struct ObjectDef {
    x       : f32,
    y       : f32,
    w       : f32,
    h       : f32,
    a       : Option<f32>
}


#[derive(Serialize, Deserialize)]
pub struct AutonomousDef {
    min_players : u32,
    max_players : u32,
    timeout     : u32
}


#[derive(Serialize, Deserialize)]
struct ServerConfigFile {
    password        : Option<String>,
    world_size      : u32,
    io_mode         : bool,
    prompt_password : Option<bool>,
    map             : Vec<ObjectDef>,
    autonomous      : Option<AutonomousDef>
}

pub struct Config {
    json : ServerConfigFile
}

impl Config {
    pub fn new(file : &str) -> Self {
        use std::fs;
        println!("Loading configuration from {}", file);
        let json_reader = fs::File::open(file).expect("Error reading config file");
        let json : ServerConfigFile = serde_json::from_reader(json_reader).expect("Error parsing JSON!");
        Self {
            json
        }
    }

    pub async fn load_into(&self, server : &mut Server) {
        server.gamesize = self.json.world_size;
        if self.json.password.is_some() {
            server.password = self.json.password.as_ref().unwrap().clone();
        }
        if self.json.prompt_password.is_some() && self.json.prompt_password.unwrap() {
            server.password = input("Game password: ");
        }
        for def in &self.json.map {
            server.place_block(def.x, def.y, match def.a {
                Some(a) => a,
                None => 0.0
            }, def.w, def.h).await;
        }
        match &self.json.autonomous {
            Some(auto) => {
                server.autonomous = Some((auto.min_players, auto.max_players, auto.timeout, auto.timeout));
            },
            None => {}
        }
    }
}