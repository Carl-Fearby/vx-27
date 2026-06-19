#[derive(Clone, Copy, Debug)]
pub struct WeaponAmmoState {
    pub rounds: i32,
    pub spare: i32,
    pub magazine_size: i32,
    pub low_ammo_threshold: i32,
}

impl WeaponAmmoState {
    pub fn new(rounds: i32, spare: i32, magazine_size: i32, low_ammo_threshold: i32) -> Self {
        Self {
            rounds: rounds.max(0),
            spare: spare.max(0),
            magazine_size: magazine_size.max(1),
            low_ammo_threshold: low_ammo_threshold.max(0),
        }
    }

    pub fn try_reload(&mut self, force: bool) -> bool {
        if self.spare <= 0 {
            return false;
        }
        if !force && self.rounds >= self.low_ammo_threshold {
            return false;
        }
        self.spare -= 1;
        self.rounds = (self.rounds + self.magazine_size).min(self.magazine_size * 2);
        true
    }

    pub fn try_consume_round(&mut self, auto_reload: bool) -> (bool, bool) {
        let mut reloaded = false;
        if self.rounds <= 0 {
            if !auto_reload || !self.try_reload(true) {
                return (false, false);
            }
            reloaded = true;
        }
        self.rounds = (self.rounds - 1).max(0);
        (true, reloaded)
    }

    pub fn to_output(&self, reloaded: bool, fired: bool) -> crate::WeaponAmmoOutput {
        crate::WeaponAmmoOutput {
            rounds: self.rounds,
            spare: self.spare,
            reloaded,
            fired,
            low_ammo: self.rounds < self.low_ammo_threshold || self.empty(),
            empty: self.empty(),
        }
    }

    pub fn empty(&self) -> bool {
        self.rounds <= 0 && self.spare <= 0
    }
}
