// Miscellaneous stuff like bullets and turrets and walls
use super::GamePieceBase;
use super::GamePiece;
use crate::Server;
use crate::physics::PhysicsObject;
use super::TargetingFilter;
use super::TargetingMode;
use super::ExplosionMode;
use crate::ProtocolMessage;
use crate::vector::Vector2;
use super::BulletType;
use crate::functions::*;
use std::f32::consts::PI;

pub struct Bullet {}
pub struct AntiRTFBullet {}
pub struct Wall {}
pub struct Chest {}
pub struct Turret {}
pub struct MissileLaunchingSystem {}
pub struct Radiation {
    halflife : f32,
    strength : f32,
    counter  : f32,
    w        : f32,
    h        : f32
}
pub struct Nuke {}
pub struct Block {}


impl Bullet {
    pub fn new() -> Self {
        Self {

        }
    }
}

impl AntiRTFBullet {
    pub fn new() -> Self {
        Self {

        }
    }
}

impl Wall {
    pub fn new() -> Self {
        Self {}
    }
}

impl Chest {
    pub fn new() -> Self {
        Self {}
    }
}

impl Turret {
    pub fn new() -> Self {
        Self {}
    }
}

impl MissileLaunchingSystem {
    pub fn new() -> Self {
        Self {}
    }
}

impl Radiation {
    pub fn new(halflife : f32, strength : f32, w : f32, h : f32) -> Self {
        println!("Radiating with halflife {} and strength {}", halflife, strength);
        Self {
            halflife,
            strength,
            counter : 0.0,
            w,
            h
        }
    }
}

impl Nuke {
    pub fn new() -> Self {
        Self {}
    }
}

impl Block {
    pub fn new() -> Self {
        Self {}
    }
}


impl GamePiece for Bullet {
    fn construct<'a>(&'a self, thing : &'a mut GamePieceBase) -> &mut GamePieceBase {
        thing.ttl = 30;
        thing.max_health = 1.0;
        thing
    }

    fn obtain_physics(&self) -> PhysicsObject {
        PhysicsObject::new(0.0, 0.0, 10.0, 10.0, 0.0)
    }

    fn identify(&self) -> char {
        'b'
    }
}

impl GamePiece for AntiRTFBullet {
    fn construct<'a>(&'a self, thing : &'a mut GamePieceBase) -> &mut GamePieceBase {
        thing.targeting.mode = TargetingMode::Nearest;
        thing.targeting.filter = TargetingFilter::RealTimeFighter;
        thing.targeting.range = (0.0, 1000.0);
        thing.max_health = 2.0;
        thing.collision_info.damage = 5.0;
        thing
    }

    fn obtain_physics(&self) -> PhysicsObject {
        PhysicsObject::new(0.0, 0.0, 30.0, 10.0, 0.0)
    }

    fn identify(&self) -> char {
        'a'
    }
    
    fn update(&mut self, master : &mut GamePieceBase, _server : &mut Server) {
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
    }


}

impl GamePiece for Wall {
    fn construct<'a>(&'a self, thing : &'a mut GamePieceBase) -> &mut GamePieceBase {
        thing.max_health = 2.0;
        thing.ttl = 1800;
        thing
    }

    fn identify(&self) -> char {
        'w'
    }

    fn get_does_collide(&self, thing : char) -> bool {
        thing != 'c' && thing != 'F' && thing != 'B' // No castles, no forts, no blocks
    }

    fn obtain_physics(&self) -> PhysicsObject {
        PhysicsObject::new(0.0, 0.0, 30.0, 30.0, 0.0)
    }
}

impl GamePiece for Chest {
    fn construct<'a>(&'a self, thing : &'a mut GamePieceBase) -> &mut GamePieceBase {
        thing.max_health = 2.0;
        thing.ttl = 4800;
        thing
    }

    fn identify(&self) -> char {
        'C'
    }

    fn obtain_physics(&self) -> PhysicsObject {
        PhysicsObject::new(0.0, 0.0, 30.0, 30.0, 0.0)
    }

    fn get_does_collide(&self, thing : char) -> bool {
        thing != 'c' && thing != 'F' && thing != 'B' // No castles, no forts, no blocks
    }

    fn capture(&self) -> u32 {
        50
    }
}

impl GamePiece for Turret {
    fn construct<'a>(&'a self, thing : &'a mut GamePieceBase) -> &mut GamePieceBase {
        thing.targeting.mode = TargetingMode::Nearest;
        thing.targeting.filter = TargetingFilter::Fighters;
        thing.targeting.range = (0.0, 500.0);
        thing.shooter_properties.shoot = true;
        thing.shooter_properties.counter = 30;
        thing
    }

    fn identify(&self) -> char {
        'T'
    }

    fn obtain_physics(&self) -> PhysicsObject {
        PhysicsObject::new(0.0, 0.0, 48.0, 22.0, 0.0)
    }

    fn update(&mut self, master : &mut GamePieceBase, _server : &mut Server) {
        match master.targeting.vector_to {
            Some(vector) => {
                master.physics.set_angle(vector.angle());
            },
            None => {}
        };
    }

    fn cost(&self) -> u32 {
        100
    }
}

impl GamePiece for MissileLaunchingSystem {
    fn construct<'a>(&'a self, thing : &'a mut GamePieceBase) -> &mut GamePieceBase {
        thing.targeting.mode = TargetingMode::Nearest;
        thing.targeting.filter = TargetingFilter::RealTimeFighter;
        thing.targeting.range = (0.0, 1000.0);
        thing.shooter_properties.shoot = true;
        thing.shooter_properties.bullet_type = BulletType::AntiRTF;
        thing.shooter_properties.counter = 150;
        thing.shooter_properties.range = 1000;
        thing.collision_info.damage = 5.0;
        thing
    }

    fn identify(&self) -> char {
        'm'
    }

    fn obtain_physics(&self) -> PhysicsObject {
        PhysicsObject::new(0.0, 0.0, 48.0, 22.0, 0.0)
    }

    fn update(&mut self, master : &mut GamePieceBase, _server : &mut Server) {
        match master.targeting.vector_to {
            Some(vector) => {
                master.physics.set_angle(vector.angle());
                master.shooter_properties.suppress = false;
            },
            None => {
                master.shooter_properties.suppress = true; // don't fire when there isn't a target, these guys are supposed to be more convenient than regular turrets
            }
        };
    }

    fn cost(&self) -> u32 {
        100
    }
}

impl GamePiece for Radiation {
    fn identify(&self) -> char {
        'r'
    }

    fn obtain_physics(&self) -> PhysicsObject {
        PhysicsObject::new(0.0, 0.0, self.w, self.h, 0.0)
    }

    fn update(&mut self, master : &mut GamePieceBase, _server : &mut Server) {
        let strength = (0.5_f32).powf(self.counter/self.halflife) * self.strength;
        self.counter += 1.0;
        master.collision_info.damage = strength/15.0;
        master.broadcast(ProtocolMessage {
            command: 'r',
            args: vec![master.get_id().to_string(), strength.to_string()]
        });
        if strength < 0.01 {
            master.health = 0.0;
        }
    }

    fn get_does_collide(&self, _id : char) -> bool {
        false
    }
}

impl GamePiece for Nuke {
    fn construct<'a>(&'a self, thing : &'a mut GamePieceBase) -> &mut GamePieceBase {
        thing.exploder = vec![
            ExplosionMode::Radiation(100.0, 60.0, 0.7),
            ExplosionMode::Radiation(600.0, 250.0, 0.2)
        ];
        thing.collision_info.damage = 0.0;
        thing.ttl = 500;
        thing
    }

    fn identify(&self) -> char {
        'n'
    }

    fn obtain_physics(&self) -> PhysicsObject {
        PhysicsObject::new(0.0, 0.0, 36.0, 36.0, 0.0)
    }

    fn cost(&self) -> u32 {
        300
    }

    fn update(&mut self, master : &mut GamePieceBase, _server : &mut Server) {
        let thrust = Vector2::new(master.goal_x - master.physics.cx(), master.goal_y - master.physics.cy()).unit() * 0.1;
        master.physics.velocity = master.physics.velocity + thrust;
        master.physics.velocity = master.physics.velocity * 0.999;
    }

    fn is_editable(&self) -> bool {
        true
    }
}

impl GamePiece for Block {
    fn construct<'a>(&'a self, thing : &'a mut GamePieceBase) -> &mut GamePieceBase {
        thing.physics.mass *= 1.0;//100.0; // Very high density: inexorable push
        thing.collision_info.damage = 0.0; // Does no collision damage
        thing.physics.solid = true;
        thing.max_health = 1000.0;
        thing.physics.fixed = true;
        thing
    }

    fn identify(&self) -> char {
        'B'
    }

    fn update(&mut self, master : &mut GamePieceBase, _server : &mut Server) {
        master.health = master.max_health; // it cannot die
    }

    fn obtain_physics(&self) -> PhysicsObject {
        PhysicsObject::new(0.0, 0.0, 300.0, 300.0, 0.0)
    }
}