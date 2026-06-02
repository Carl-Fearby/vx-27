# Bullet FPS Optimization - Quick Verification Checklist

## ✅ Implementation Status: COMPLETE

All optimizations have been implemented and committed:
- ✅ Shared material pool (no per-shot material creation)
- ✅ Removed per-shot material disposal
- ✅ Strengthened GPU warmup to 10 frames
- ✅ Proper cleanup functions for warmup bolts

---

## 🚀 Quick Test (5 minutes)

### Prerequisites
```bash
cd /Users/F7905607/Dropbox/Projects/GameEngine2
npm install  # If needed
npm run dev  # Start dev server with HTTPS
```

### Manual Verification Steps

1. **Hard Refresh Browser**
   - Open https://localhost:3000 in Firefox/Chrome
   - Hard refresh: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows)
   - Wait for "Ready" (100%) in load bar

2. **Test First Shots**
   - Click canvas to lock mouse
   - Fire 3-4 shots in rapid succession
   - **PASS:** Bolts move smoothly from frame 1 (no apparent slowness)
   - **FAIL:** First bolt crawls visibly or advances erratically

3. **Frame Rate Check** (Optional)
   - Enable FPS counter: Press **H** to toggle HUD, check console
   - Fire 3 shots and observe FPS value
   - **Expected:** Stays 55-60 FPS (no dips below 30)

---

## 🔍 Advanced Verification (DevTools)

### Performance Tab
1. Open DevTools: **F12**
2. Go to Performance / Performance Monitor
3. Record frame times while firing 3 shots
4. **Metric:** Max frame time should be **< 20ms** on all shots
5. **Red flag:** Frame > 50ms on any of first 3 shots

### Console Inspection
Look for any error or warning related to:
- Shader compilation failures
- Material disposal errors
- Geometry issues

---

## 📊 Expected Results

| Test | Expected | Problem? |
|------|----------|----------|
| First shot not slow | ✅ Smooth motion | ❌ Crawling = material hitch |
| FPS counter | ✅ 55-60 range | ❌ Dips < 30 = GPU stall |
| DevTools render time | ✅ All < 20ms | ❌ Any > 50ms = warmup fail |
| No console errors | ✅ Clean console | ❌ Errors = logic bug |

---

## 🐛 Troubleshooting

### Issue: First shot still appears slow
- Clear browser cache (`npm run dev:reset`)
- Check hard refresh worked (network tab should show cache hits after first shot)
- Open console, verify no errors during load

### Issue: Hitches on 2nd+ shots
- Not expected from this optimization. Separate issue.
- Check oil barrel proximity damage, collision detection, or grenade physics

### Issue: Load time increased significantly
- Expected: +0.5 sec for 10-frame warmup pool
- If > 1 sec increase, check network/GPU to diagnose other bottlenecks

---

## 📝 Sign-Off Checklist

Run through this when ready to deploy:

- [ ] Hard refresh test: First shot appears smooth (no crawling)
- [ ] FPS monitor: Stays 55-60 FPS throughout 3-4 shots
- [ ] DevTools: Frame times all < 20ms
- [ ] Console: No shader/material errors
- [ ] Load time: Acceptable (baseline + ~0.5 sec)
- [ ] Ready for production deployment

---

## 📋 Changes Committed

1. **Commit 1:** `Bullet FPS optimization: shared pool materials, stronger GPU warmup`
   - Core optimization logic
   - Material pooling patterns
   - Warmup frame count increase

2. **Commit 2:** `Add bullet FPS optimization verification guide`
   - This documentation
   - Testing patterns
   - Performance metrics

---

## 🎯 Next Phase (if needed)

If you observe hitches on **first wall hit** or **first target hit** (not first shot):
- Issue: Impact decals/blood not pre-warmed for all surface types
- Solution: Extend `warmupBulletHolesGpu()` or pool hit effects
- Effort: 1-2 hours; similar pattern to bullet pool optimization

---

## Questions?

Refer to `BULLET_FPS_OPTIMIZATION.md` for deep dives into:
- Root cause analysis
- Before/after code comparisons
- GPU warmup details
- Extension patterns for other systems

**Status:** Ready to test and deploy. ✅

