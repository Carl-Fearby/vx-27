"use client";

import { memo } from "react";
import { PRIMARY_WEAPONS } from "@/lib/weapons/PrimaryWeapons";
import {
  getPrimarySlotForWeapon,
  getPrimarySlotStackFrameStyle,
  getVisiblePrimarySlotKeys,
  PRIMARY_SLOT_UI,
} from "@/lib/weapons/PrimaryWeaponSlots";
import { resolveStackSelection } from "@/lib/ui/WeaponStackLayout";

const HudPrimaryWeaponStack = memo(function HudPrimaryWeaponStack({
  activePrimaryWeapon,
  primaryAmmo,
  frameX,
  frameY,
  layoutStyle,
}) {
  const activeSlotKey = getPrimarySlotForWeapon(activePrimaryWeapon);
  const visibleSlots = getVisiblePrimarySlotKeys();
  const stackSelected = resolveStackSelection(activeSlotKey, visibleSlots);

  if (visibleSlots.length === 0) return null;

  return (
    <div
      className="hudPrimaryWeapon"
      aria-label="Primary weapons"
      style={{
        "--grenade-frame-x": `${-frameX}px`,
        "--grenade-frame-y": `${frameY}px`,
        ...layoutStyle,
      }}
    >
      <div className="hudPrimaryWeaponSlots">
        {visibleSlots.map((slotKey) => {
          const slotUi = PRIMARY_SLOT_UI[slotKey];
          const weaponId = slotUi?.weaponId;
          const cfg = weaponId ? PRIMARY_WEAPONS[weaponId] : null;
          const rounds = weaponId ? (primaryAmmo[weaponId]?.rounds ?? 0) : 0;
          const isSelected = slotKey === stackSelected;
          const isEmpty = rounds === 0;

          return (
            <div
              key={slotKey}
              className={[
                "hudPrimaryWeaponFrame",
                isSelected ? "hudPrimaryWeaponFrame--selected" : "",
                isEmpty ? "hudPrimaryWeaponEmpty" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={getPrimarySlotStackFrameStyle(
                slotKey,
                activeSlotKey,
                visibleSlots,
              )}
            >
              <span className="hudPrimaryWeaponKey">{slotKey}</span>
              <div className="hudPrimaryWeaponBody">
                <span className="hudPrimaryWeaponLabel">{cfg?.label}</span>
                <span className="hudPrimaryWeaponCount">
                  {String(rounds).padStart(2, "0")}
                </span>
                {slotUi?.icon ? (
                  <img
                    src={slotUi.icon}
                    className="hudPrimaryWeaponIcon"
                    alt=""
                  />
                ) : (
                  <span
                    className="hudPrimaryWeaponIcon hudPrimaryWeaponIcon--placeholder"
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default HudPrimaryWeaponStack;
