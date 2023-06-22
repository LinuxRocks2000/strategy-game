// Grand unified file for non player character types

use super::GamePieceBase;
use super::GamePiece;
use crate::Server;
use crate::physics::PhysicsObject;
use super::TargetingFilter;
use super::TargetingMode;
use crate::vector::Vector2;
use std::f32::consts::PI;
use crate::functions::*;

pub struct Red {
    start_cooldown : u32
}

pub struct White {
    start_cooldown : u32
}

pub struct Black {
    start_cooldown : u32
}

pub struct Target {
    count : u32
}

impl Red {
    pub fn new() -> Self {
        Self {
            start_cooldown : 120
        }
    }
}

impl White {
    pub fn new() -> Self {
        Self {
            start_cooldown : 120
        }
    }
}

impl Black {
    pub fn new() -> Self {
        Self {
            start_cooldown : 0
        }
    }
}

impl Target {
    pub fn new() -> Self {
        Self {
            count : 0
        }
    }
}

impl GamePiece for Red {
    fn construct<'a>(&'a self, thing : &'a mut GamePieceBase) -> &mut GamePieceBase {
        thing.targeting.mode = TargetingMode::Nearest;
        thing.targeting.filter = TargetingFilter::Castles;
        thing.speed_cap = 20.0;
        thing.targeting.range = (0.0, 0.0); // no range
        thing.ttl = 1800;
        thing.max_health = 1.0;
        thing.collision_info.damage = 2.0;
        thing
    }

    fn obtain_physics(&self) -> PhysicsObject {
        PhysicsObject::new(0.0, 0.0, 20.0, 20.0, 0.0)
    }

    fn identify(&self) -> char {
        '0'
    }

    fn get_does_collide(&self, _id : char) -> bool {
        true
    }

    fn capture(&self) -> u32 {
        5
    }

    fn update(&mut self, master : &mut GamePieceBase, _servah : &mut Server) {
        match master.targeting.vector_to {
            Some(vector_to) => {
                let goalangle = vector_to.angle();
                master.physics.change_angle(loopize(goalangle, master.physics.angle()) * 0.14);
                master.physics.thrust(0.2);
            },
            None => {}
        }
        if self.start_cooldown != 0 {
            self.start_cooldown -= 1;
            master.physics.velocity = master.physics.velocity * 0.8;
        }
    }
}

impl GamePiece for White {
    fn construct<'a>(&'a self, thing : &'a mut GamePieceBase) -> &mut GamePieceBase {
        thing.targeting.mode = TargetingMode::Nearest;
        thing.targeting.filter = TargetingFilter::Fighters;
        thing.targeting.range = (0.0, 0.0); // no range
        thing.speed_cap = 15.0;
        thing.ttl = 1800;
        thing.max_health = 1.0;
        thing.collision_info.damage = 2.0;
        thing
    }

    fn obtain_physics(&self) -> PhysicsObject {
        PhysicsObject::new(0.0, 0.0, 20.0, 20.0, 0.0)
    }

    fn identify(&self) -> char {
        '1'
    }

    fn get_does_collide(&self, _id : char) -> bool {
        true
    }

    fn capture(&self) -> u32 {
        5
    }

    fn update(&mut self, master : &mut GamePieceBase, _servah : &mut Server) {
        match master.targeting.vector_to {
            Some(vector_to) => {
                let goalangle = vector_to.angle();
                master.physics.change_angle(loopize(goalangle, master.physics.angle()) * 0.25);
                master.physics.thrust(0.2);
            },
            None => {}
        }
        if self.start_cooldown != 0 {
            self.start_cooldown -= 1;
            master.physics.velocity = master.physics.velocity * 0.8;
        }
    }
}

impl GamePiece for Black {
    fn construct<'a>(&'a self, thing : &'a mut GamePieceBase) -> &mut GamePieceBase {
        thing.targeting.mode = TargetingMode::Nearest;
        thing.targeting.filter = TargetingFilter::Castles;
        thing.targeting.range = (0.0, 0.0); // no range
        thing.ttl = 1800;
        thing.max_health = 1.0;
        thing.speed_cap = 35.0; // Very slightly slower than a speedship
        thing.collision_info.damage = 2.0;
        thing
    }

    fn obtain_physics(&self) -> PhysicsObject {
        PhysicsObject::new(0.0, 0.0, 20.0, 20.0, 0.0)
    }

    fn identify(&self) -> char {
        '2'
    }

    fn get_does_collide(&self, id : char) -> bool {
        id == 'c' || id == 'R' || id == 'b'
    }

    fn capture(&self) -> u32 {
        5
    }

    fn update(&mut self, master : &mut GamePieceBase, _servah : &mut Server) {
        match master.targeting.vector_to {
            Some(vector_to) => {
                let goalangle = vector_to.angle();
                master.physics.change_angle(loopize(goalangle, master.physics.angle()) * 0.2);
                master.physics.thrust(1.0);
                if (master.physics.velocity.angle() - goalangle).abs() > PI/4.0 {
                    master.physics.velocity = master.physics.velocity * 0.95;
                }
            },
            None => {}
        }
        if self.start_cooldown != 0 {
            self.start_cooldown -= 1;
            master.physics.velocity = master.physics.velocity * 0.8;
        }
    }
}

impl GamePiece for Target {
    fn construct<'a>(&'a self, thing : &'a mut GamePieceBase) -> &mut GamePieceBase {
        thing.ttl = 1800;
        thing.max_health = 3.0;
        thing.speed_cap = 10.0;
        thing.collision_info.damage = 0.1; // inoffensive
        thing
    }

    fn obtain_physics(&self) -> PhysicsObject {
        PhysicsObject::new(0.0, 0.0, 40.0, 40.0, 0.0)
    }

    fn identify(&self) -> char {
        '3'
    }

    fn get_does_collide(&self, id : char) -> bool {
        id == 'b' // is unaffected by everything but bullets
    }

    fn capture(&self) -> u32 {
        30
    }

    fn update(&mut self, master : &mut GamePieceBase, server : &mut Server) {
        if master.physics.velocity.magnitude() != master.speed_cap || self.count == 0 {
            let item = rand::random::<f32>() * PI * 2.0;
            master.physics.velocity = Vector2::new_from_manda(master.speed_cap, item);
            self.count = 60;
        }
        self.count -= 1;
        master.physics.set_cx(coterminal(master.physics.cx(), server.gamesize as f32));
        master.physics.set_cy(coterminal(master.physics.cy(), server.gamesize as f32));
    }
}