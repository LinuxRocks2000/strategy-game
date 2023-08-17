// Grand unified file for fighter types

use super::GamePieceBase;
use super::GamePiece;
use crate::Server;
use crate::physics::PhysicsObject;
use crate::vector::Vector2;
use std::f32::consts::PI;


pub struct BasicFighter {}
pub struct TieFighter {}
pub struct Sniper {}
pub struct Missile {}


impl BasicFighter {
    pub fn new() -> Self {
        Self {}
    }
}

impl TieFighter {
    pub fn new() -> Self {
        Self {}
    }
}

impl Sniper {
    pub fn new() -> Self {
        Self {}
    }
}

impl Missile {
    pub fn new() -> Self {
        Self {}
    }
}


impl GamePiece for BasicFighter {
    fn construct<'a>(&'a self, thing : &'a mut GamePieceBase) -> &mut GamePieceBase {
        thing.shooter_properties.shoot = true;
        thing.shooter_properties.counter = 30;
        thing
    }

    fn obtain_physics(&self) -> PhysicsObject {
        PhysicsObject::new(0.0, 0.0, 48.0, 36.0, 0.0)
    }

    fn identify(&self) -> char {
        'f'
    }

    fn get_does_collide(&self, id : char) -> bool {
        id != 'c'
    }

    fn cost(&self) -> u32 {
        10
    }

    fn update(&mut self, master : &mut GamePieceBase, _servah : &mut Server) {
        let mut thrust = Vector2::new(master.goal_x - master.physics.cx(), master.goal_y - master.physics.cy());
        if thrust.magnitude() < 10.0 {
            master.physics.set_angle(master.goal_a);
        }
        else {
            thrust = thrust.unit() * 0.25;
            master.physics.set_angle(thrust.angle());
            master.physics.velocity = master.physics.velocity + thrust;
        }
        master.physics.velocity = master.physics.velocity * 0.95;
    }

    fn is_editable(&self) -> bool {
        true
    }
}

impl GamePiece for TieFighter {
    fn construct<'a>(&'a self, thing : &'a mut GamePieceBase) -> &mut GamePieceBase {
        thing.shooter_properties.shoot = true;
        thing.shooter_properties.counter = 40;
        thing.shooter_properties.angles = vec![0.0, PI];
        thing
    }

    fn obtain_physics(&self) -> PhysicsObject {
        PhysicsObject::new(0.0, 0.0, 32.0, 36.0, 0.0)
    }

    fn identify(&self) -> char {
        't'
    }

    fn get_does_collide(&self, id : char) -> bool {
        id != 'c'
    }

    fn cost(&self) -> u32 {
        20
    }

    fn update(&mut self, master : &mut GamePieceBase, _servah : &mut Server) {
        let mut thrust = Vector2::new(master.goal_x - master.physics.cx(), master.goal_y - master.physics.cy());
        if thrust.magnitude() < 10.0 {
            master.physics.set_angle(master.goal_a);
        }
        else {
            thrust = thrust.unit() * 0.35;
            master.physics.set_angle(thrust.angle());
            master.physics.velocity = master.physics.velocity + thrust;
        }
        master.physics.velocity = master.physics.velocity * 0.95;
    }

    fn is_editable(&self) -> bool {
        true
    }
}

impl GamePiece for Sniper {
    fn construct<'a>(&'a self, thing : &'a mut GamePieceBase) -> &mut GamePieceBase {
        thing.shooter_properties.shoot = true;
        thing.shooter_properties.counter = 80;
        thing.shooter_properties.range = 90;
        thing
    }

    fn obtain_physics(&self) -> PhysicsObject {
        PhysicsObject::new(0.0, 0.0, 48.0, 17.0, 0.0)
    }

    fn identify(&self) -> char {
        's'
    }

    fn get_does_collide(&self, id : char) -> bool {
        id != 'c'
    }

    fn cost(&self) -> u32 {
        30
    }

    fn update(&mut self, master : &mut GamePieceBase, _servah : &mut Server) {
        let mut thrust = Vector2::new(master.goal_x - master.physics.cx(), master.goal_y - master.physics.cy());
        if thrust.magnitude() < 10.0 {
            master.physics.set_angle(master.goal_a);
        }
        else {
            thrust = thrust.unit() * 1.2;
            master.physics.set_angle(thrust.angle());
            master.physics.velocity = master.physics.velocity + thrust;
        }
        master.physics.velocity = master.physics.velocity * 0.9;
    }

    fn is_editable(&self) -> bool {
        true
    }
}

impl GamePiece for Missile {
    fn obtain_physics(&self) -> PhysicsObject {
        PhysicsObject::new(0.0, 0.0, 48.0, 20.0, 0.0)
    }

    fn identify(&self) -> char {
        'h'
    }

    fn get_does_collide(&self, _id : char) -> bool {
        true
    }

    fn cost(&self) -> u32 {
        5
    }

    fn update(&mut self, master : &mut GamePieceBase, _servah : &mut Server) {
        let goal = Vector2::new(master.goal_x - master.physics.cx(), master.goal_y - master.physics.cy());
        master.physics.set_angle(master.physics.angle() * 0.9 + goal.angle() * 0.1);
        let thrust = Vector2::new_from_manda(0.3, master.physics.angle());
        master.physics.velocity = master.physics.velocity + thrust;
        master.physics.velocity = master.physics.velocity * 0.99;
    }

    fn is_editable(&self) -> bool {
        true
    }
}