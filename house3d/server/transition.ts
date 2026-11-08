import {airingBed} from '../shared/airing.mjs';
import {connectHome} from './connect-home.js';
import {planObjectDestination} from '../shared/object-destination.mjs';
import {drawable, validateDrawing, drawingWidth, drawingHeight} from './crayon.mjs';
import {createSpace,spaceBounds} from '../shared/space.mjs';
import {
  type State,
  type Data,
  type Context,
  clone,
  record,
  extra,
  requireValue,
  number,
  length,
} from "./types.js";
import {
  ROOM_DEFAULT,
  LIMITS,
  boundaries,
  footprint,
  parseSupport,
  validateLayout,
  definition,
} from "./geometry.js";
import { busy, actionsFor, readingDesk, drawingBook, riceSource } from "./objects.js";
export function transition(
  input: State,
  command: Data,
  ctx: Context,
  { check_geometry = true, check_busy = true, navigation_start = null }: Data = {},
): State {
  let state = clone(input);
  const op = command.tool,
    args = command.arguments === undefined ? {} : command.arguments;
  requireValue(record(args), "arguments must be an object");
  const def =
    typeof op === "string" && Object.hasOwn(ctx.definitions, op)
      ? ctx.definitions[op]
      : undefined;
  requireValue(!!def, "Unknown or unavailable tool");
  const [, props, required] = def;
  requireValue(!extra(args, Object.keys(props)), "Unknown argument");
  requireValue(
    required.every((k) => k in args),
    "Required argument missing",
  );
  if (
    check_busy &&
    busy(state) &&
    [
      "apply_layout",
      "place_furniture",
      "update_furniture",
      "remove_furniture",
      "move_character",
      "set_activity",
      "apply_preset",
      "connect_rooms",
    ].includes(op)
  )
    throw Error(
      "Finish the current object interaction with interact/leave before moving furniture or the character",
    );
  const mutate = (s: State, c: Data, o: Data = {}) => transition(s, c, ctx, o);
  if(op==='connect_rooms'){
    requireValue(typeof (args.dry_run??true)==='boolean'&&args.dry_run!==null,'dry_run must be boolean');
    connectHome(state,ctx,navigation_start);
    mutate(state,{tool:'move_character',arguments:{x:state.character.x,z:state.character.z}},{check_busy:false});
  }else if (op === "draw_crayon") {
    validateDrawing(args.title,args.marks);
    const sessionBook = busy(state) && state.interaction?.pose==="draw" ? state.interaction.related_id : null;
    const target = 'target_id' in args ? args.target_id : sessionBook;
    const book = ('target_id' in args || target!=null) ? state.objects.find(o=>o.id===target && drawable(o)) : state.objects.find(drawable);
    requireValue(!('target_id' in args) || book, "Target must be an open workbook or picture book");
    const previous = book ? book.artwork : state.last_drawing;
    if ("base_url" in args) requireValue(typeof args.base_url==="string" && previous?.url===args.base_url &&
      (previous.target_id??null)===(book?.id??null), "base_url must match the current drawing on this page");
    state.last_drawing = {title:args.title.trim(),width:drawingWidth,height:drawingHeight,target_id:book?.id ?? null,url:`/api/drawings/${state.revision+1}.png`};
    if(book) book.artwork = state.last_drawing;
  } else if (op === "set_wallpaper") {
    if (Array.isArray(args.wallpaper_id))
      throw Error("unhashable type: 'list'");
    requireValue(
      ["all", "back", "front", "left", "right"].includes(args.wall_id) &&
        typeof args.wallpaper_id === "string" &&
        Object.hasOwn(ctx.wallpapers, args.wallpaper_id),
      "Unknown wall or wallpaper; choose from get_catalog",
    );
    const room = { ...ROOM_DEFAULT, ...state.room },
      papers = { ...ROOM_DEFAULT.wallpapers, ...room.wallpapers };
    for (const wall of args.wall_id === "all"
      ? Object.keys(papers)
      : [args.wall_id])
      papers[wall] = args.wallpaper_id;
    state.room = { ...room, wallpapers: papers };
  } else if (op === "update_room") {
    const resizing = Object.keys(args).some((k) => k in LIMITS||k==='balcony');
    if(resizing&&state.room?.floorplan&&check_geometry)throw Error("Connected room partitions cannot be resized while furnished");
    if (resizing && check_busy && busy(state))
      throw Error("Finish the interaction before resizing the room");
    requireValue(
      typeof (args.dry_run === undefined ? false : args.dry_run) === "boolean",
      "dry_run must be boolean",
    );
    for (const [k, v] of Object.entries(args)) {
      if (k === "dry_run") continue;
      if(k==='balcony'){
       requireValue(v===null||(record(v)&&!extra(v,['wall','center','width','depth','door_id'])&&['wall','center','width','depth','door_id'].every(k=>k in v)),"Invalid balcony configuration");
       if(v){requireValue(['left','back'].includes(v.wall),"Balcony wall must be left or back");number(v.center,-6,6);number(v.width,3,6);number(v.depth,1.8,3);requireValue(typeof v.door_id==='string'&&length(v.door_id)>0&&length(v.door_id)<=64,"Invalid balcony door id")}
       continue;
      }
      if (k in LIMITS) {
        number(v, ...LIMITS[k], true);
        continue;
      }
      if (k === "style") {
        requireValue(
          ["classic", "urban"].includes(v as string),
          "Unknown room style",
        );
        continue;
      }
      requireValue(
        typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v),
        "Expected #RRGGBB room paint",
      );
    }
    const { dry_run, ...finish } = args;
    state.room = { ...ROOM_DEFAULT, ...state.room, ...finish };
    if(state.room.balcony===null)delete state.room.balcony;
    if (resizing) {
      const bounds = boundaries(state.room);
      for (const obj of state.objects) {
        if (ctx.assets[obj.asset_id || ""]?.placement !== "wall") continue;
        const [w, d] = footprint(obj, ctx);
        if (Math.abs(obj.yaw) < 0.001) obj.z = -bounds.furniture_z + d / 2;
        else obj.x = -bounds.furniture_x + w / 2;
      }
      if (check_geometry) {
        validateLayout(state, ctx);
        mutate(
          state,
          {
            tool: "move_character",
            arguments: { x: state.character.x, z: state.character.z },
          },
          { check_busy: false },
        );
      }
    }
  } else if (op === "walk_to") {
    requireValue(!busy(state), "Finish the current action first");
    const objectTarget = "target_id" in args;
    requireValue(objectTarget ? !("x" in args || "z" in args) : "x" in args && "z" in args, "Use target_id OR x and z, not both");
    let planned: Data | null = null;
    if (objectTarget) {
      requireValue(typeof args.target_id === "string" && args.target_id.length > 0, "Invalid target_id");
      requireValue(navigation_start, "A fresh visible standing body is required to plan an object destination");
      planned = planObjectDestination(state.objects, ctx.catalog, ctx.assets, state.room ?? {}, navigation_start, args.target_id);
      requireValue(planned.ok, planned.reason);
    }
    const b = boundaries(state.room),extent=spaceBounds(state.room),
      point = planned?.point ?? {
        x: number(args.x, (state.room?.balcony||state.room?.floorplan)?extent.minX:-b.body_x,(state.room?.balcony||state.room?.floorplan)?extent.maxX:b.body_x),
        z: number(args.z, (state.room?.balcony||state.room?.floorplan)?extent.minZ:-b.body_z,(state.room?.balcony||state.room?.floorplan)?extent.maxZ:b.body_z),
      };
    mutate(state, { tool: "move_character", arguments: point });
    state.interaction = {
      id: command.id || "walk-" + (state.revision + 1),
      target_id: objectTarget ? args.target_id : null,
      target: point,
      action: "walk_to",
      pose: "walk",
      phase: "requested",
      error: null,
      approach_index: null,
    };
  } else if (op === "cancel_action") {
    const old = state.interaction || {};
    requireValue(
      busy(state) && old.id === args.job_id,
      "No matching active job",
    );
    state.interaction = {
      ...old,
      id: command.id || "cancel-" + (state.revision + 1),
      action: "leave",
      phase: "requested",
      from_active: ["active", "entering"].includes(old.phase),
      error: null,
    };
  } else if (op === "interact") {
    const obj = state.objects.find((o) => o.id === args.target_id);
    requireValue(obj, "Target object not found");
    const action = args.action;
    requireValue(
      actionsFor(obj, ctx, state).some((a) => a.id === action && a.available),
      "Action unavailable for this object/state",
    );
    if(action==="serve_rice"){
      const pot=riceSource(obj,state)!;
      pot.properties={...pot.properties,servings:pot.properties?.keep_full?4:(pot.properties?.servings??4)-1};
      obj.properties={...obj.properties,filled:true};
    } else if(action==="air_quilt"){
      obj.properties={...obj.properties,quilt_from:airingBed(state,obj)!.id};
    } else if(action==="bring_in_quilt"){
      delete obj.properties!.quilt_from;
    } else if(action==="eat_rice"){obj.properties={...obj.properties,filled:false};
    } else if(action==="refill_rice"){obj.properties={...obj.properties,servings:4};
    } else if (action==="tidy" || action==="unpack") {
      obj.properties = {...obj.properties, packed: action==="tidy"};
    } else if (["turn_on", "turn_off"].includes(action)) {
      obj.properties ??= obj.kind==="tv"?{on:true}:{ on: true, brightness: 0.7 };
      obj.properties.on = action === "turn_on";
    } else if (["cover", "uncover"].includes(action)) {
      obj.properties ??= { covered: true };
      obj.properties.covered = action === "cover";
    } else {
      const old = state.interaction || {};
      state.interaction = {
        id: command.id || "interaction-" + (state.revision + 1),
        target_id: obj.id,
        action,
        pose: action === "leave" ? old.pose : action,
        related_id:
          action === "draw" ? drawingBook(obj,state)!.id : action === "read"
            ? readingDesk(obj, state)!.id
            : action === "leave"
              ? (old.related_id ?? null)
              : null,
        phase: "requested",
        approach_index:
          action === "leave" ? (old.approach_index ?? null) : null,
        from_active:
          action === "leave" && ["active", "entering"].includes(old.phase),
        error: null,
      };
    }
  } else if (op === "update_object") {
    const obj = state.objects.find((o) => o.id === args.id);
    requireValue(obj, "Target object not found");
    if ("label" in args) {
      requireValue(
        typeof args.label === "string" &&
          length(args.label) >= 1 &&
          length(args.label) <= 40,
        "Label must be 1..40 characters",
      );
      obj.label = args.label;
    }
    if ("properties" in args) {
      const p = args.properties,
        allowed =
          obj.id===state.room?.balcony?.door_id? ["open"] : obj.kind==="tv"?["on"]:obj.asset_id==="home-rice-cooker-v1"?["keep_full"]:obj.kind === "lamp"
            ? ["on", "brightness"]
            : ctx.assets[obj.asset_id || ""]?.interactions?.sleep
              ? ["covered"]
              : [];
      requireValue(
        record(p) && allowed.length && !extra(p, allowed),
        "Unsupported object properties",
      );
      if('open' in p){requireValue(typeof p.open==='boolean',"open must be boolean");requireValue(!check_busy||!busy(state),"Finish the current action before changing the balcony door")}
      if ("keep_full" in p)requireValue(typeof p.keep_full==="boolean","keep_full must be boolean");
      if ("covered" in p)
        requireValue(typeof p.covered === "boolean", "covered must be boolean");
      if ("on" in p)
        requireValue(typeof p.on === "boolean", "on must be boolean");
      if ("brightness" in p) number(p.brightness, 0, 1);
      obj.properties = {
        ...(obj.id===state.room?.balcony?.door_id?{open:obj.properties?.open??true}:obj.properties ??
          (obj.kind==="tv"?{on:true}:obj.asset_id==="home-rice-cooker-v1"?{servings:4}:obj.kind === "lamp"
            ? { on: true, brightness: 0.7 }
            : { covered: true })),
        ...p,...(p.keep_full===true?{servings:4}:{}),
      };
    }
    if(obj.id===state.room?.balcony?.door_id&&check_geometry)validateLayout(state,ctx);
  } else if (op === "apply_layout") {
    requireValue(
      Array.isArray(args.objects) && args.objects.length <= (state.room?.floorplan?128:80),
      state.room?.floorplan?"Expected at most 128 furniture items":"Expected at most 80 furniture items",
    );
    let trial: State = { ...clone(state), objects: [] };
    for (const item of args.objects) {
      requireValue(record(item), "Invalid furniture item");
      trial = mutate(
        trial,
        { tool: "place_furniture", arguments: item },
        { check_geometry: false, check_busy: false },
      );
    }
    validateLayout(trial, ctx);
    state.objects = trial.objects;
  } else if (op === "set_camera") {
    requireValue(
      ["home", "album", "broadcast", "companion", "portrait", "front", "face", "side", "back", "top"].includes(
        args.preset,
      ),
      "Unknown camera preset",
    );
    state.camera = args.preset;
  } else if (op === "set_light") {
    requireValue(
      ["day", "evening", "night"].includes(args.preset),
      "Unknown light preset",
    );
    state.light = args.preset;
  } else if (op === "set_note") {
    requireValue(
      typeof args.text === "string" && length(args.text) <= 240,
      "Note must be at most 240 characters",
    );
    state.note = args.text;
  } else if (
    ["place_furniture", "update_furniture", "remove_furniture"].includes(op)
  ) {
    const id = args.id;
    requireValue(
      typeof id === "string" && length(id) >= 1 && length(id) <= 64,
      "Invalid furniture id",
    );
    let obj = state.objects.find((o) => o.id === id);
    if (op === "place_furniture") {
      requireValue(!obj, "Furniture id already exists");
      requireValue(state.objects.length < (state.room?.floorplan?128:80), "Room item limit reached");
      requireValue(
        typeof args.kind === "string" &&
          (Object.hasOwn(ctx.catalog, args.kind) ||
            (typeof args.asset_id === "string" &&
              ctx.assets[args.asset_id]?.kind === args.kind)),
        "Unknown furniture kind",
      );
      requireValue(
        "on" in args || ("x" in args && "z" in args),
        "Floor placement requires x and z",
      );
      obj = { id, kind: args.kind, x: 0, z: 0, yaw: 0, color: "#c39a78" };
      state.objects.push(obj);
    } else requireValue(obj, "Furniture not found");
    if (op === "remove_furniture")
      state.objects = state.objects.filter((o) => o !== obj);
    else {
      if ("asset_id" in args) {
        requireValue(
          typeof args.asset_id === "string" &&
            ctx.assets[args.asset_id]?.kind === obj!.kind,
          "Unknown or mismatched asset",
        );
        obj!.asset_id = args.asset_id;
        delete obj!.color;
      }
      if (
        "color" in args &&
        obj!.asset_id &&
        !ctx.assets[obj!.asset_id].recolorable
      )
        throw Error(
          "Painted asset is not recolorable; choose another asset variant",
        );
      if ("on" in args) obj!.on = parseSupport(args.on);
      else if (obj!.on && ["x", "z", "yaw"].some((k) => k in args))
        throw Error("Move supported props with on local offsets");
      for (const k of ["x", "z", "yaw"])
        if (k in args)
          obj![k] = number(
            args[k],
            k === "yaw" ? -Math.PI * 2 : (state.room?.balcony||state.room?.floorplan)? Math.min(-6,spaceBounds(state.room)[k==='x'?'minX':'minZ']):-6,
            k === "yaw" ? Math.PI * 2 : (state.room?.balcony||state.room?.floorplan)? Math.max(6,spaceBounds(state.room)[k==='x'?'maxX':'maxZ']):6,
          );
      if ("color" in args) {
        requireValue(
          typeof args.color === "string" &&
            /^#[0-9a-fA-F]{6}$/.test(args.color),
          "Expected #RRGGBB",
        );
        obj!.color = args.color;
      }
    }
    if (
      op !== "remove_furniture" &&
      ("label" in args || "properties" in args)
    ) {
      const changes = Object.fromEntries(
        Object.entries(args).filter(([k]) =>
          ["id", "label", "properties"].includes(k),
        ),
      );
      state.objects = mutate(state, {
        tool: "update_object",
        arguments: changes,
      },{check_geometry,check_busy}).objects;
    }
    if (check_geometry) validateLayout(state, ctx);
  } else if (op === "apply_preset") {
    requireValue(
      typeof (args.dry_run === undefined ? true : args.dry_run) === "boolean",
      "dry_run must be boolean",
    );
    requireValue(
      typeof args.preset_id === "string" &&
        Object.hasOwn(ctx.presets, args.preset_id),
      "Choose a preset_id from get_presets",
    );
    const preset = ctx.presets[args.preset_id],
      rev = state.revision;
    let trial: State = { ...clone(state), objects: [] };
    if(trial.room){delete trial.room.floorplan;delete trial.room.child_finish}
    trial = mutate(
      trial,
      {
        tool: "update_room",
        arguments: Object.fromEntries(
          Object.entries({...preset.room,...(state.room?.balcony&&!preset.room.balcony?{balcony:null}:{})}).filter(([k]) => k !== "wallpapers"),
        ),
      },
      { check_busy: false, check_geometry: false },
    );
    for (const [wall_id, wallpaper_id] of Object.entries(
      preset.room.wallpapers || {},
    ))
      trial = mutate(
        trial,
        { tool: "set_wallpaper", arguments: { wall_id, wallpaper_id } },
        { check_busy: false },
      );
    trial = mutate(
      trial,
      { tool: "apply_layout", arguments: { objects: preset.objects } },
      { check_busy: false },
    );
    trial = mutate(
      trial,
      { tool: "move_character", arguments: preset.spawn },
      { check_busy: false },
    );
    delete trial.interaction;
    Object.assign(trial, {
      revision: rev,
      camera: "home",
      light: "day",
      preset_id: args.preset_id,
    });
    trial.control_revisions = {
      ...trial.control_revisions,
      ...Object.fromEntries(
        ["position", "activity", "camera", "light"].map((k) => [k, rev + 1]),
      ),
    };
    state = trial;
  } else if (op === "set_activity") {
    requireValue(
      ["idle", "walk", "sit"].includes(args.activity),
      "Only idle, walk and sit are currently available",
    );
    state.character.activity = args.activity;
  } else if (op === "move_character") {
    const b = boundaries(state.room),extent=spaceBounds(state.room),
      x = number(args.x, (state.room?.balcony||state.room?.floorplan)?extent.minX:-b.body_x,(state.room?.balcony||state.room?.floorplan)?extent.maxX:b.body_x),
      z = number(args.z, (state.room?.balcony||state.room?.floorplan)?extent.minZ:-b.body_z,(state.room?.balcony||state.room?.floorplan)?extent.maxZ:b.body_z);
    if(state.room?.balcony||state.room?.floorplan)requireValue(createSpace(state.room,state.objects).free({x,z}),"Target is outside walkable space or blocked by wall/railing/closed door");
    for (const obj of state.objects) {
      if (obj.kind === "rug" || obj.on||obj.id===state.room?.balcony?.door_id) continue;
      const [w, d] = definition(obj, ctx).size,
        c = Math.cos(obj.yaw),
        s = Math.sin(obj.yaw),
        dx = x - obj.x,
        dz = z - obj.z,
        u = Math.abs(dx * c - dz * s),
        v = Math.abs(dx * s + dz * c);
      requireValue(
        Math.hypot(Math.max(0, u - w / 2), Math.max(0, v - d / 2)) >= 0.57,
        "Target is occupied",
      );
    }
    Object.assign(state.character, { x, z, activity: "idle" });
    if ("yaw" in args)
      state.character.yaw = number(args.yaw, -Math.PI * 2, Math.PI * 2);
  } else throw Error("Unknown or unavailable tool");
  const control = (
    {
      set_camera: "camera",
      set_light: "light",
      set_note: "note",
      set_activity: "activity",
      move_character: "position",
    } as Data
  )[op];
  if (control) {
    state.control_revisions ??= {};
    state.control_revisions[control] = state.revision + 1;
  }
  state.revision++;
  return state;
}
