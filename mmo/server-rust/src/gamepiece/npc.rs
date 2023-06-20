// Grand unified file for fighter types

use super::GamePieceBase;
use super::GamePiece;
use crate::Server;
use crate::physics::PhysicsObject;
use super::TargetingFilter;
use super::TargetingMode;
use std::f32::consts::PI;

pub fn loopize_about(set : f32, cur : f32, about : f32) -> f32 {
    if (set - cur).abs() >= about / 2.0 {
        if set > cur {
            return -(about - set + cur);
        }
        else {
            return about - cur + set;
        }
    }
    set - cur
}

pub fn loopize(set : f32, cur : f32) -> f32 {
    /*set - cur*/loopize_about(set, cur, PI * 2.0)
}

pub struct Red {
    start_cooldown : u32
}

pub struct White {
    start_cooldown : u32
}

pub struct Black {
    start_cooldown : u32
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
        id == 'c' || id == 'R'
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
                    master.physics.velocity = master.physics.velocity * 0.9;
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