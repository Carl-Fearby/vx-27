pub fn imul(a: u32, b: u32) -> u32 {
    (a as i32).wrapping_mul(b as i32) as u32
}

pub struct Mulberry32 {
    state: u32,
}

impl Mulberry32 {
    pub fn new(seed: u32) -> Self {
        Self { state: seed }
    }

    pub fn next(&mut self) -> f64 {
        self.state = self.state.wrapping_add(0x6d2b_79f5);
        let mut r = imul(self.state ^ (self.state >> 15), 1 | self.state);
        r ^= r.wrapping_add(imul(r ^ (r >> 7), 61 | r));
        ((r ^ (r >> 14)) as u32) as f64 / 4_294_967_296.0
    }
}

pub fn mulberry32(seed: u32) -> Mulberry32 {
    Mulberry32::new(seed)
}

pub fn hash_node_id(id: &str) -> u32 {
    let mut h: i32 = 0;
    for ch in id.chars() {
        h = imul(31, h as u32) as i32 + ch as i32;
    }
    h as u32
}

pub fn get_aim_salt(state: &crate::state::HackGameState) -> u32 {
    imul(state.aim_roll, 0x27d4_eb2d) ^ state.aim_nonce
}

pub fn random_u32() -> u32 {
    let mut bytes = [0u8; 4];
    if getrandom::getrandom(&mut bytes).is_ok() {
        u32::from_le_bytes(bytes)
    } else {
        0xdeadc0de
    }
}
