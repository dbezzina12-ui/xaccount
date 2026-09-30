# Validation report

Generated 2026-09-30T14:34:26.444Z by `scripts/validate.mjs` (each GLB opened in a fresh browser context with only the GLB + its JSON).

## master_blank — PASS (27/27 checks)

| check | result | detail |
|---|---|---|
| `parts.present` | ✅ | found 16: Foot_L, Foot_R, Forearm_L, Forearm_R, Hand_L, Hand_R, Head, Neck, Pelvis, Shin_L, Shin_R, Thigh_L, Thigh_R, Torso, UpperArm_L, UpperArm_R |
| `skeleton.single` | ✅ | 1 Skeleton objects, 1 distinct joint lists, 63 joints |
| `skeleton.matchesConfig` | ✅ | 63 bones in config |
| `sockets.parented` | ✅ | socket_hand_L_prop->hand_L, socket_hand_R_prop->hand_R, socket_head_accessory->head, socket_back_accessory->chest |
| `clips.named` | ✅ | _qa_pose_cycle, cheer, float_idle, float_monk, float_monk_loop, idle, jump_in_place, pistol_aim, pistol_fire, press_button, reach_grip_handle, rifle_aim, rifle_fire, run_in_place, staff_idle, staff_strike, sword_2h_idle, sword_2h_slash, walk_in_place, wave |
| `uv.inRange` | ✅ | 17067 UVs in [0,1] |
| `weights.normalized` | ✅ | max /1-sum/ = 4.16e-8, max influences 4 |
| `seams.boundaryLoops` | ✅ | 375 shared boundary vertices across 17 part pairs |
| `seams.normalsMatch` | ✅ | min dot of boundary normals 1.000000 |
| `seams.noCracksInClips` | ✅ | max gap 0.00e+0 m over 781 frames (null) |
| `bones.lengthsConstant` | ✅ | max length drift 2.59e-6 m (shin_R->foot_R float_monk@1.47) – forearms/shins never shorten |
| `sockets.followBones` | ✅ | max change of socket-in-bone matrix 8.88e-16 |
| `helpers.halfRotation` | ✅ | max /helper - source/2/ = 0.035 deg (hip_helper_L _qa_pose_cycle@0.00) |
| `hand_L.palmFacesBody` | ✅ | palm normal -0.706,-0.708,0 (expected toward the body and down) |
| `hand_L.thumbRadialSide` | ✅ | thumb 0.0241 m in front of index knuckle; index 0.0601 m in front of pinky (A-pose, palms in) |
| `hand_R.palmFacesBody` | ✅ | palm normal 0.706,-0.708,0 (expected toward the body and down) |
| `hand_R.thumbRadialSide` | ✅ | thumb 0.0241 m in front of index knuckle; index 0.0601 m in front of pinky (A-pose, palms in) |
| `grip.noPenetration` | ✅ | 0 hand vertices >1 mm inside the handle (deepest 0.00 mm) |
| `grip.contact` | ✅ | 60 vertices within 4 mm of the handle surface; socket 0.000 mm from the handle axis |
| `press.contact` | ✅ | fingertip -1.05 mm from button top at contact frame; pressed 7.02 mm (button travel 6.0 mm) |
| `clips.extendedSet` | ✅ | 16 clips present |
| `feet.aboveGround` | ✅ | feet at most 2.0 mm below the rest ground plane in game clips (float_monk@0.60s); _qa_ stress poses excluded |
| `float.hovers` | ✅ | float_idle 0.137 m, float_monk_loop 0.667 m, float_monk(end) 0.697 m |
| `locomotion.inPlace` | ✅ | jump_in_place pelvis drift 0.025 m, run_in_place pelvis drift 0.012 m, walk_in_place pelvis drift 0.024 m |
| `weapons.twoHandGrip` | ✅ | support hand within 0.001 mm of the prop's grip_L marker on every frame (worst staff_strike@0.93s) |
| `weapons.gripNoPenetration` | ✅ | deepest hand vertex 0.00 mm inside a grip |
| `weapons.gripContact` | ✅ | min 45 hand vertices within 4 mm of each grip |

**Viewer export → fresh reload:** PASS (28/28 checks; material {'type': 'MeshStandardMaterial', 'hasMap': True, 'mapSize': [2048, 2048]})

Boundary vertices per part pair: `{"Foot_L+Shin_L": 24, "Foot_R+Shin_R": 24, "Forearm_L+UpperArm_L": 24, "Forearm_L+Hand_L": 24, "Forearm_R+UpperArm_R": 24, "Forearm_R+Hand_R": 24, "Head+Neck": 32, "Neck+Torso": 32, "Pelvis+Thigh_L+Thigh_R": 2, "Pelvis+Thigh_L": 15, "Pelvis+Thigh_R": 15, "Pelvis+Torso": 32, "Shin_L+Thigh_L": 24, "Shin_R+Thigh_R": 24, "Thigh_L+Thigh_R": 7, "Torso+UpperArm_L": 24, "Torso+UpperArm_R": 24}`

Grip: `{"holdTime": 2.2666666666666666, "verticesInsideHandle": 0, "deepest_mm": 0, "contactVertices": 60, "socketToAxis_mm": 0}` · Press: `{"fingertipAboveButtonAtContact_mm": -1.05, "pressDepth_mm": 7.02, "travel_mm": 5.96590909090909}`

### blank material — test poses (2 angles each)

![](sheets/master_blank_blank_poses.jpg)

### blank material — joint close-ups

![](sheets/master_blank_blank_closeups.jpg)

### checker material — test poses (2 angles each)

![](sheets/master_blank_checker_poses.jpg)

### checker material — joint close-ups

![](sheets/master_blank_checker_closeups.jpg)

### Viewer-exported GLB reloaded in a fresh page (texture embedded)

![](roundtrip/master_blank_reloaded_textured.png)

### Projection references + part-ID masks

![](sheets/master_blank_references.jpg)

Coverage by the 5 reference views (UV texels): `{"none": 0.0271, "grazing": 0.0669, "one": 0.3869, "multi": 0.519}`; single view alone: `{"front": 0.502, "back": 0.4126, "left": 0.3142, "right": 0.3145, "front_three_quarter": 0.4908}`

## stocky_test — PASS (27/27 checks)

| check | result | detail |
|---|---|---|
| `parts.present` | ✅ | found 16: Foot_L, Foot_R, Forearm_L, Forearm_R, Hand_L, Hand_R, Head, Neck, Pelvis, Shin_L, Shin_R, Thigh_L, Thigh_R, Torso, UpperArm_L, UpperArm_R |
| `skeleton.single` | ✅ | 1 Skeleton objects, 1 distinct joint lists, 63 joints |
| `skeleton.matchesConfig` | ✅ | 63 bones in config |
| `sockets.parented` | ✅ | socket_hand_L_prop->hand_L, socket_hand_R_prop->hand_R, socket_head_accessory->head, socket_back_accessory->chest |
| `clips.named` | ✅ | _qa_pose_cycle, cheer, float_idle, float_monk, float_monk_loop, idle, jump_in_place, pistol_aim, pistol_fire, press_button, reach_grip_handle, rifle_aim, rifle_fire, run_in_place, staff_idle, staff_strike, sword_2h_idle, sword_2h_slash, walk_in_place, wave |
| `uv.inRange` | ✅ | 17067 UVs in [0,1] |
| `weights.normalized` | ✅ | max /1-sum/ = 4.47e-8, max influences 4 |
| `seams.boundaryLoops` | ✅ | 375 shared boundary vertices across 17 part pairs |
| `seams.normalsMatch` | ✅ | min dot of boundary normals 1.000000 |
| `seams.noCracksInClips` | ✅ | max gap 0.00e+0 m over 781 frames (null) |
| `bones.lengthsConstant` | ✅ | max length drift 2.44e-6 m (shin_L->foot_L float_monk@1.67) – forearms/shins never shorten |
| `sockets.followBones` | ✅ | max change of socket-in-bone matrix 6.94e-16 |
| `helpers.halfRotation` | ✅ | max /helper - source/2/ = 0.023 deg (shoulder_helper_R idle@3.40) |
| `hand_L.palmFacesBody` | ✅ | palm normal -0.706,-0.708,0 (expected toward the body and down) |
| `hand_L.thumbRadialSide` | ✅ | thumb 0.0254 m in front of index knuckle; index 0.0633 m in front of pinky (A-pose, palms in) |
| `hand_R.palmFacesBody` | ✅ | palm normal 0.706,-0.708,0 (expected toward the body and down) |
| `hand_R.thumbRadialSide` | ✅ | thumb 0.0254 m in front of index knuckle; index 0.0633 m in front of pinky (A-pose, palms in) |
| `grip.noPenetration` | ✅ | 0 hand vertices >1 mm inside the handle (deepest 0.00 mm) |
| `grip.contact` | ✅ | 65 vertices within 4 mm of the handle surface; socket 0.000 mm from the handle axis |
| `press.contact` | ✅ | fingertip -1.11 mm from button top at contact frame; pressed 6.98 mm (button travel 5.9 mm) |
| `clips.extendedSet` | ✅ | 16 clips present |
| `feet.aboveGround` | ✅ | feet at most 2.6 mm below the rest ground plane in game clips (float_monk@0.60s); _qa_ stress poses excluded |
| `float.hovers` | ✅ | float_idle 0.127 m, float_monk_loop 0.591 m, float_monk(end) 0.621 m |
| `locomotion.inPlace` | ✅ | jump_in_place pelvis drift 0.025 m, run_in_place pelvis drift 0.012 m, walk_in_place pelvis drift 0.023 m |
| `weapons.twoHandGrip` | ✅ | support hand within 0.001 mm of the prop's grip_L marker on every frame (worst staff_strike@0.40s) |
| `weapons.gripNoPenetration` | ✅ | deepest hand vertex 0.00 mm inside a grip |
| `weapons.gripContact` | ✅ | min 39 hand vertices within 4 mm of each grip |

**Viewer export → fresh reload:** PASS (28/28 checks; material {'type': 'MeshStandardMaterial', 'hasMap': True, 'mapSize': [2048, 2048]})

Boundary vertices per part pair: `{"Foot_L+Shin_L": 24, "Foot_R+Shin_R": 24, "Forearm_L+UpperArm_L": 24, "Forearm_L+Hand_L": 24, "Forearm_R+UpperArm_R": 24, "Forearm_R+Hand_R": 24, "Head+Neck": 32, "Neck+Torso": 32, "Pelvis+Thigh_L+Thigh_R": 2, "Pelvis+Thigh_L": 15, "Pelvis+Thigh_R": 15, "Pelvis+Torso": 32, "Shin_L+Thigh_L": 24, "Shin_R+Thigh_R": 24, "Thigh_L+Thigh_R": 7, "Torso+UpperArm_L": 24, "Torso+UpperArm_R": 24}`

Grip: `{"holdTime": 2.2666666666666666, "verticesInsideHandle": 0, "deepest_mm": 0, "contactVertices": 65, "socketToAxis_mm": 0}` · Press: `{"fingertipAboveButtonAtContact_mm": -1.11, "pressDepth_mm": 6.98, "travel_mm": 5.873578221144881}`

### blank material — test poses (2 angles each)

![](sheets/stocky_test_blank_poses.jpg)

### blank material — joint close-ups

![](sheets/stocky_test_blank_closeups.jpg)

### checker material — test poses (2 angles each)

![](sheets/stocky_test_checker_poses.jpg)

### checker material — joint close-ups

![](sheets/stocky_test_checker_closeups.jpg)

### Viewer-exported GLB reloaded in a fresh page (texture embedded)

![](roundtrip/stocky_test_reloaded_textured.png)

### Projection references + part-ID masks

![](sheets/stocky_test_references.jpg)

Coverage by the 5 reference views (UV texels): `{"none": 0.0314, "grazing": 0.068, "one": 0.3873, "multi": 0.5133}`; single view alone: `{"front": 0.4981, "back": 0.409, "left": 0.3127, "right": 0.3128, "front_three_quarter": 0.4863}`

## diag_textured_test — PASS (28/28 checks)

| check | result | detail |
|---|---|---|
| `parts.present` | ✅ | found 16: Foot_L, Foot_R, Forearm_L, Forearm_R, Hand_L, Hand_R, Head, Neck, Pelvis, Shin_L, Shin_R, Thigh_L, Thigh_R, Torso, UpperArm_L, UpperArm_R |
| `skeleton.single` | ✅ | 1 Skeleton objects, 1 distinct joint lists, 63 joints |
| `skeleton.matchesConfig` | ✅ | 63 bones in config |
| `sockets.parented` | ✅ | socket_hand_L_prop->hand_L, socket_hand_R_prop->hand_R, socket_head_accessory->head, socket_back_accessory->chest |
| `clips.named` | ✅ | _qa_pose_cycle, cheer, float_idle, float_monk, float_monk_loop, idle, jump_in_place, pistol_aim, pistol_fire, press_button, reach_grip_handle, rifle_aim, rifle_fire, run_in_place, staff_idle, staff_strike, sword_2h_idle, sword_2h_slash, walk_in_place, wave |
| `uv.inRange` | ✅ | 17067 UVs in [0,1] |
| `weights.normalized` | ✅ | max /1-sum/ = 4.47e-8, max influences 4 |
| `material.texture` | ✅ | {"type":"MeshStandardMaterial","hasMap":true,"mapSize":[2048,2048]} |
| `seams.boundaryLoops` | ✅ | 375 shared boundary vertices across 17 part pairs |
| `seams.normalsMatch` | ✅ | min dot of boundary normals 1.000000 |
| `seams.noCracksInClips` | ✅ | max gap 0.00e+0 m over 781 frames (null) |
| `bones.lengthsConstant` | ✅ | max length drift 2.44e-6 m (shin_L->foot_L float_monk@1.67) – forearms/shins never shorten |
| `sockets.followBones` | ✅ | max change of socket-in-bone matrix 6.94e-16 |
| `helpers.halfRotation` | ✅ | max /helper - source/2/ = 0.023 deg (shoulder_helper_R idle@3.40) |
| `hand_L.palmFacesBody` | ✅ | palm normal -0.706,-0.708,0 (expected toward the body and down) |
| `hand_L.thumbRadialSide` | ✅ | thumb 0.0254 m in front of index knuckle; index 0.0633 m in front of pinky (A-pose, palms in) |
| `hand_R.palmFacesBody` | ✅ | palm normal 0.706,-0.708,0 (expected toward the body and down) |
| `hand_R.thumbRadialSide` | ✅ | thumb 0.0254 m in front of index knuckle; index 0.0633 m in front of pinky (A-pose, palms in) |
| `grip.noPenetration` | ✅ | 0 hand vertices >1 mm inside the handle (deepest 0.00 mm) |
| `grip.contact` | ✅ | 65 vertices within 4 mm of the handle surface; socket 0.000 mm from the handle axis |
| `press.contact` | ✅ | fingertip -1.11 mm from button top at contact frame; pressed 6.98 mm (button travel 5.9 mm) |
| `clips.extendedSet` | ✅ | 16 clips present |
| `feet.aboveGround` | ✅ | feet at most 2.6 mm below the rest ground plane in game clips (float_monk@0.60s); _qa_ stress poses excluded |
| `float.hovers` | ✅ | float_idle 0.127 m, float_monk_loop 0.591 m, float_monk(end) 0.621 m |
| `locomotion.inPlace` | ✅ | jump_in_place pelvis drift 0.025 m, run_in_place pelvis drift 0.012 m, walk_in_place pelvis drift 0.023 m |
| `weapons.twoHandGrip` | ✅ | support hand within 0.001 mm of the prop's grip_L marker on every frame (worst staff_strike@0.40s) |
| `weapons.gripNoPenetration` | ✅ | deepest hand vertex 0.00 mm inside a grip |
| `weapons.gripContact` | ✅ | min 39 hand vertices within 4 mm of each grip |

**Viewer export → fresh reload:** PASS (28/28 checks; material {'type': 'MeshStandardMaterial', 'hasMap': True, 'mapSize': [2048, 2048]})

Boundary vertices per part pair: `{"Foot_L+Shin_L": 24, "Foot_R+Shin_R": 24, "Forearm_L+UpperArm_L": 24, "Forearm_L+Hand_L": 24, "Forearm_R+UpperArm_R": 24, "Forearm_R+Hand_R": 24, "Head+Neck": 32, "Neck+Torso": 32, "Pelvis+Thigh_L+Thigh_R": 2, "Pelvis+Thigh_L": 15, "Pelvis+Thigh_R": 15, "Pelvis+Torso": 32, "Shin_L+Thigh_L": 24, "Shin_R+Thigh_R": 24, "Thigh_L+Thigh_R": 7, "Torso+UpperArm_L": 24, "Torso+UpperArm_R": 24}`

Grip: `{"holdTime": 2.2666666666666666, "verticesInsideHandle": 0, "deepest_mm": 0, "contactVertices": 65, "socketToAxis_mm": 0}` · Press: `{"fingertipAboveButtonAtContact_mm": -1.11, "pressDepth_mm": 6.98, "travel_mm": 5.873578221144881}`

### original material — test poses (2 angles each)

![](sheets/diag_textured_test_original_poses.jpg)

### original material — joint close-ups

![](sheets/diag_textured_test_original_closeups.jpg)

### checker material — test poses (2 angles each)

![](sheets/diag_textured_test_checker_poses.jpg)

### checker material — joint close-ups

![](sheets/diag_textured_test_checker_closeups.jpg)

### Viewer-exported GLB reloaded in a fresh page (texture embedded)

![](roundtrip/diag_textured_test_reloaded_textured.png)

### Projection references + part-ID masks

![](sheets/diag_textured_test_references.jpg)

Coverage by the 5 reference views (UV texels): `{"none": 0.0314, "grazing": 0.068, "one": 0.3873, "multi": 0.5133}`; single view alone: `{"front": 0.4981, "back": 0.409, "left": 0.3127, "right": 0.3128, "front_three_quarter": 0.4863}`
