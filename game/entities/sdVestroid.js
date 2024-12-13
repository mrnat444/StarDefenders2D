/*

	Wasp-inspired enemy with swarming behavior. Randomly attacks other entities nearby, or whatever damages it

*/

/* global Infinity */

import sdWorld from '../sdWorld.js';
import sdSound from '../sdSound.js';
import sdEntity from './sdEntity.js';
import sdEffect from './sdEffect.js';
import sdGun from './sdGun.js';
import sdGib from './sdGib.js';
import sdWater from './sdWater.js';
import sdCom from './sdCom.js';
import sdBullet from './sdBullet.js';
import sdBlock from './sdBlock.js';
// import { sdServerConfigFull } from '../server/sdServerConfig.js';
// import sdCharacter from './sdCharacter.js';
// import sdCube from './sdCube.js';
// import sdBaseShieldingUnit from './sdBaseShieldingUnit.js';
// import sdCrystal from './sdCrystal.js';
// import sdPathFinding from '../ai/sdPathFinding.js';
// import sdCable from './sdCable.js';
// import sdEnemyMech from './sdEnemyMech.js';

class sdVestroid extends sdEntity
{
	static init_class()
	{
		sdVestroid.img_vestroid = sdWorld.CreateImageFromFile( 'sdVestroid' ); // Resprite by Flora

		sdVestroid.all_vestroids = [];
		
		sdVestroid.death_duration = 30;
		sdVestroid.post_death_ttl = 120;
		
		sdVestroid.attack_range = 300;
		sdVestroid.seek_range = 600;


		sdVestroid.TYPE_DRONE = 0;
		sdVestroid.TYPE_GUNSHIP = 1;
		sdVestroid.TYPE_TURRET = 2;

		sdVestroid.GUN_BULLETS = 0;
		sdVestroid.GUN_DUAL_BULLETS = 1;
		sdVestroid.GUN_ROCKETS = 2;
		sdVestroid.GUN_RAILS = 3;
		
		sdVestroid.reusable_vision_blocking_entities_array = [ this.name ];
	
		sdWorld.entity_classes[ this.name ] = this; // Register for object spawn
	}
	get hitbox_x1() { return this.type === sdVestroid.TYPE_GUNSHIP ? -36 : this.type === sdVestroid.TYPE_DRONE ? -17 : -10; }
	get hitbox_x2() { return this.type === sdVestroid.TYPE_GUNSHIP ? 36 : this.type === sdVestroid.TYPE_DRONE ? 17 : 10; }
	get hitbox_y1() { return this.type === sdVestroid.TYPE_GUNSHIP ? -16 : this.type === sdVestroid.TYPE_DRONE ? -19 : -10; }
	get hitbox_y2() { return this.type === sdVestroid.TYPE_GUNSHIP ? 16 : this.type === sdVestroid.TYPE_DRONE ? 19 : 10; }
	
	get hard_collision() // For world geometry where players can walk
	{ return true; }
	
	constructor( params )
	{
		super( params );
		
		this.sx = 0;
		this.sy = 0;
		
		this._regen_timeout = 0;

		this._smoke_spawn_wish = 0;
		
		this.type = params.type || 0;

		this.hmax = 
			this.type === sdVestroid.TYPE_GUNSHIP ? 6000 : 
			this.type === sdVestroid.TYPE_DRONE ? 2000 : 
			4000;

		this.hea = this.hmax;

		// this._ai_team = 11;
		this.tilt = 0;
		
		this._time_until_full_remove = this.type === sdVestroid.TYPE_GUNSHIP ? 30 * 3 : 30 * 2;

		//this.death_anim = 0;
		
		this._current_target = null;
		//this._pathfinding = null;
		this._follow_target = null;
		
		//this._last_stand_on = null;
		//this._last_jump = sdWorld.time;
		//this._last_bite = sdWorld.time;
		
		this._move_dir_x = 0;
		this._move_dir_y = 0;
		this._move_dir_timer = 0;
		
		this._move_speed = 
			this.type === sdVestroid.TYPE_GUNSHIP ? 4 : 
			this.type === sdVestroid.TYPE_DRONE ? 12 : 
			6;

		this._hover = Math.random();

		//this._rocket_time_until_attack = 0;
		// this.attack_anim = 0;
		//this._aggressive_mode = false; // Causes dodging and faster movement
		//this._rockets = 4;
		
		this.side = 1;
		this.look_x = 0;
		this.look_y = 0;

		//this._alert_intensity = 0; // Grows until some value and only then it will shoot
		
		this._last_damage = 0; // Sound flood prevention


		this.wea_type1 = ~~( Math.random() * 4 );

		this._bullets_max1 = Math.min( ~~( 1 / Math.random() ), 5 ) * 
		(
			this.wea_type1 === sdVestroid.GUN_DUAL_BULLETS ? 5 : 
			this.wea_type1 === sdVestroid.GUN_ROCKETS ? 3 : 
			this.wea_type1 === sdVestroid.GUN_RAILS ? 2 : 
			10
		);
		this._bullets1 = this._bullets_max1;
		
		this._attack_timer1 = 0;
		
		this.wea_an1 = 0; // Rotate angle for LMG firing


		this.wea_type2 = ~~( Math.random() * 4 );

		this._bullets_max2 = Math.min( ~~( 1 / Math.random() ), 5 ) * 
		(
			this.wea_type2 === sdVestroid.GUN_DUAL_BULLETS ? 5 : 
			this.wea_type2 === sdVestroid.GUN_ROCKETS ? 3 : 
			this.wea_type2 === sdVestroid.GUN_RAILS ? 2 : 
			10
		);
		this._bullets2 = this._bullets_max2;

		this._attack_timer2 = 0;

		this.wea_an2 = 0; // Rotate angle for LMG firing
		

		//this._last_seen_player = 0;

		this.filter = 'none';//'hue-rotate(' + ~~( Math.random() * 360 ) + 'deg)';

		sdVestroid.all_vestroids.push( this );
	}
	SetTarget( ent )
	{
		if ( ent !== this._current_target )
		{
			this._current_target = ent;

			/*if ( ent )
			this._pathfinding = new sdPathFinding({ target: ent, traveler: this, attack_range: 1000, options: [ sdPathFinding.OPTION_CAN_FLY, sdPathFinding.OPTION_CAN_GO_THROUGH_WALLS, sdPathFinding.OPTION_CAN_SWIM ] });
			else
			this._pathfinding = null;*/
		}
	}
	/*SyncedToPlayer( character ) // Shortcut for enemies to react to players
	{
		if ( this.hea > 0 )
		if ( character.hea > 0 )
		{
			if ( this._last_seen_player < sdWorld.time - 1000 * 60 * 5 ) // Once per 5 minutes
			sdSound.PlaySound({ name:'enemy_mech_alert', x:this.x, y:this.y, volume:2 });
		
			this._last_seen_player = sdWorld.time;
		}
	}*/
	/*GetBleedEffect()
	{
		return sdEffect.TYPE_BLOOD_GREEN;
	}*/
	/*GetBleedEffectFilter()
	{
		return this.filter;
	}*/
	/* CanAttackEnt( ent )
	{
		//if ( ent.GetClass() !== 'sdCharacter' )
		if ( !ent.is( sdCharacter ) )
		{
			if ( typeof ent._ai_team !== 'undefined' ) // Does a potential target belong to a faction?
			{
				if ( ent._ai_team !== this._ai_team && ( ( ent._hea || ent.hea || -1 ) > 0 ) ) // Is this not a friendly faction? And is this close enough? (And is it alive?)
				return true; // Target it
			}
			else
			return true; // Target it
		}
		else
		{
			if ( ( ent === this._current_target && ent._ai_team !== this._ai_team ) || ent.build_tool_level >= 10  )
			return true;
			else
			{
				if ( ( ( ent.build_tool_level >= 10 && ent._ai_team === 0 ) && ent._ai_team !== this._ai_team ) || ( ent._ai_enabled !== sdCharacter.AI_MODEL_NONE && ent._ai_team !== this._ai_team ) )
				{
					this._current_target = ent; // Don't stop targetting if the player has below 800 matter mid fight
					return true; // Only players have mercy from mechs
				}
			}
		}
		
		return false;
	} */
	FireWeapon( weapon, target )
	{
		let wea_type = weapon === 0 ? this.wea_type1 : this.wea_type2;

		let targ_x = target.x;
		let targ_y = target.y;

		if ( target.is( sdBlock ) )
		{
			targ_x = target.x + ( target.hitbox_x2 / 2 );
			targ_y = target.y + ( target.hitbox_y2 / 2 );
		}

		let xx = this.x + ( this.type === sdVestroid.TYPE_GUNSHIP ? ( weapon === 0 ? -35 : 35 ) : 0 );
		let yy = this.y + ( this.type === sdVestroid.TYPE_GUNSHIP ? 14 : this.type === sdVestroid.TYPE_DRONE ? 16 : 0 );

		if ( wea_type === sdVestroid.GUN_BULLETS )
		{
			let an = Math.atan2( targ_y - yy, targ_x - xx );
	
			if ( weapon === 0 )
			this.wea_an1 = an * 100;
			else
			this.wea_an2 = an * 100;

			an += ( Math.random() * 2 - 1 ) * 0.1;
	
	
			let bullet_obj = new sdBullet({ x: xx, y: yy });
			bullet_obj._owner = this;
			bullet_obj.sx = Math.cos( an );
			bullet_obj.sy = Math.sin( an );
			bullet_obj.x += bullet_obj.sx * 3;
			bullet_obj.y += bullet_obj.sy * 3;
	
			bullet_obj.sx *= 15;
			bullet_obj.sy *= 15;
	
			bullet_obj._damage = 15;

			sdEntity.entities.push( bullet_obj );
			
			sdSound.PlaySound({ name:'enemy_mech_attack4', x:this.x, y:this.y, volume:1, pitch: 1 });
		}
		else
		if ( wea_type === sdVestroid.GUN_DUAL_BULLETS )
		{
			let an = Math.atan2( targ_y - yy, targ_x - xx );
	
			if ( weapon === 0 )
			this.wea_an1 = an * 100;
			else
			this.wea_an2 = an * 100;
	
			an += ( Math.random() * 2 - 1 ) * 0.05;

	
			let bullet_obj = new sdBullet({ x: xx - ( Math.sin( an ) * 5 ) , y: yy + ( Math.cos( an ) * 5 ) });
			bullet_obj._owner = this;
			bullet_obj.sx = Math.cos( an );
			bullet_obj.sy = Math.sin( an );
			bullet_obj.x += bullet_obj.sx * 3;
			bullet_obj.y += bullet_obj.sy * 3;
	
			bullet_obj.sx *= 20;
			bullet_obj.sy *= 20;
	
			bullet_obj._damage = 15;
	
			sdEntity.entities.push( bullet_obj );
	
			let bullet_obj2 = new sdBullet({ x: xx + ( Math.sin( an ) * 3 ) , y: yy - ( Math.cos( an ) * 3 ) });
			bullet_obj2._owner = this;
			bullet_obj2.sx = Math.cos( an );
			bullet_obj2.sy = Math.sin( an );
			bullet_obj2.x += bullet_obj2.sx * 3;
			bullet_obj2.y += bullet_obj2.sy * 3;
	
			bullet_obj2.sx *= 20;
			bullet_obj2.sy *= 20;
	
			bullet_obj2._damage = 15;

			sdEntity.entities.push( bullet_obj2 );
			
			sdSound.PlaySound({ name:'enemy_mech_attack4', x:this.x, y:this.y, volume:1, pitch: 1 });
		}
		else
		if ( wea_type === sdVestroid.GUN_ROCKETS )
		{
			let an = Math.atan2( targ_y - yy, targ_x - xx );

			if ( weapon === 0 )
			this.wea_an1 = an * 100;
			else
			this.wea_an2 = an * 100;
	
			an += ( Math.random() * 2 - 1 ) * 0.2;

			// this.look_x = targ_x;
			// this.look_y = targ_y;
	
	
			let bullet_obj = new sdBullet({ x: xx, y: yy });
			bullet_obj._owner = this;
			bullet_obj.sx = Math.cos( an );
			bullet_obj.sy = Math.sin( an );
			bullet_obj.x += bullet_obj.sx * 5;
			bullet_obj.y += bullet_obj.sy * 5;
	
			bullet_obj.sx *= 15;
			bullet_obj.sy *= 15;
	
			bullet_obj.time_left = 60;
	
			//bullet_obj._rail = true;
	
			bullet_obj.explosion_radius = 12;
			bullet_obj._damage = 1;
			bullet_obj.color = '#00ffff';
			bullet_obj.model = 'rocket_proj';
			bullet_obj._homing = true;
			bullet_obj._homing_mult = 0.03;
			bullet_obj.ac = 0.03;
			
			sdEntity.entities.push( bullet_obj );
	
			//sdSound.PlaySound({ name:'gun_pistol', pitch: 1, x:this.x, y:this.y, volume:0.3 });
			sdSound.PlaySound({ name:'enemy_mech_attack4', x:this.x, y:this.y, volume:1, pitch: 1 });
		}
		else
		if ( wea_type === sdVestroid.GUN_RAILS )
		{
			let bullets = weapon === 0 ? this._bullets1 : this._bullets2;
			let bullets_max = weapon === 0 ? this._bullets_max1 : this._bullets_max2;

			let delay = 500;

			let sx = ( target.sx || 0 ) * delay * 0.04;
			let sy = ( target.sy || 0 ) * delay * 0.04;

			let an;
			if ( bullets < bullets_max )
			an = ( weapon === 0 ? this.wea_an1 : this.wea_an2 ) / 100;
			else
			{
				an = Math.atan2( targ_y + sy - yy, targ_x + sx - xx );

				if ( weapon === 0 )
				this.wea_an1 = an * 100;
				else
				this.wea_an2 = an * 100;
			}

			xx -= this.x;
			yy -= this.y;

			setTimeout(()=>
			{
				if ( !this._is_being_removed )
				if ( this.hea > 0 && this._frozen <= 0 ) // Not disabled in time
				{
					an += ( Math.random() * 2 - 1 ) * 0.1;
	
	
					let bullet_obj = new sdBullet({ x: this.x + xx, y: this.y + yy });
					bullet_obj._owner = this;
					bullet_obj.sx = Math.cos( an );
					bullet_obj.sy = Math.sin( an );
					bullet_obj.x += bullet_obj.sx * 20;
					bullet_obj.y += bullet_obj.sy * 20;
		
					bullet_obj.sx *= 15;
					bullet_obj.sy *= 15;
		
					bullet_obj._rail = true;
					bullet_obj._rail_circled = true;
		
					bullet_obj._damage = 15;
					bullet_obj.color = '#ffaaff';
		
					sdEntity.entities.push( bullet_obj );
		
					//sdSound.PlaySound({ name:'gun_pistol', pitch: 1, x:this.x, y:this.y, volume:0.3 });
					sdSound.PlaySound({ name:'enemy_mech_attack4', x:this.x, y:this.y, volume:1, pitch: 1 });
				}
			}, delay );
		}
		else
		{
			return;
		}

		let fire_rate = 
			wea_type === sdVestroid.GUN_DUAL_BULLETS ? 8 : 
			wea_type === sdVestroid.GUN_ROCKETS ? 10 : 
			wea_type === sdVestroid.GUN_RAILS ? 2 : 
			2;

		let reload_mult = 
			wea_type === sdVestroid.GUN_DUAL_BULLETS ? 7 : 
			wea_type === sdVestroid.GUN_ROCKETS ? 20 : 
			wea_type === sdVestroid.GUN_RAILS ? 10 : 
			3;

		if ( weapon === 0 )
		{
			this._bullets1--;

			if ( this._bullets1 <= 0 )
			{
				this._bullets1 = this._bullets_max1;
				
				this._attack_timer1 = this._bullets_max1 * reload_mult;
			}
			else
			this._attack_timer1 = fire_rate;
		}
		else
		{
			this._bullets2--;

			if ( this._bullets2 <= 0 )
			{
				this._bullets2 = this._bullets_max2;
				
				this._attack_timer2 = this._bullets_max2 * reload_mult;
			}
			else
			this._attack_timer2 = fire_rate;
		}
	}
	CanAttackEnt( ent )
	{
		if ( ent.is( sdVestroid ) )
		return false;

		return true;
	}
	GetRandomEntityNearby() // Scans random area on map for potential entities
	{
		// if ( this._current_target && !this._current_target._is_being_removed )
		// return this._current_target;

		// if ( this._follow_target ) 
		// return this._follow_target;

		let an = Math.random() * Math.PI * 2;

		if ( !sdWorld.CheckLineOfSight( this.x, this.y, this.x + Math.sin( an ) * sdVestroid.seek_range, this.y + Math.cos( an ) * sdVestroid.seek_range, this ) )
		if ( sdWorld.last_hit_entity )
		{
			let e = sdWorld.last_hit_entity;

			if ( sdCom.com_faction_attack_classes.indexOf( e.GetClass() ) !== -1 && e.IsVisible( this ) && e.IsTargetable( this ) && this.CanAttackEnt( e ) )
			return e;
		}

		for ( let i = 0; i < sdVestroid.all_vestroids.length; i++ )
		{
			let ent = sdVestroid.all_vestroids[ i ];

			if ( ent && !ent._is_being_removed && ent._current_target && !ent._current_target._is_being_removed )
			if ( ent._current_target !== this._current_target )
			if ( sdWorld.inDist2D_Boolean( this.x, this.y, ent.x, ent.y, sdVestroid.attack_range ) )
			return ent._current_target;
		}

		if ( Math.random() < 0.1 && !this.CanMoveWithoutOverlap( this.x, this.y, -4, null, [ 'sdVestroid' ] ) ) // Try to get unstuck
		if ( sdWorld.last_hit_entity && !sdWorld.last_hit_entity._shielded )
		return sdWorld.last_hit_entity;

		/*let x = sdWorld.world_bounds.x1 + Math.random() * ( sdWorld.world_bounds.x2 - sdWorld.world_bounds.x1 );
		let y = sdWorld.world_bounds.y1 + Math.random() * ( sdWorld.world_bounds.y2 - sdWorld.world_bounds.y1 );
		
		let targets_raw = sdWorld.GetAnythingNear( this.x, this.y, 256, null, [ 'sdCharacter', 'sdPlayerDrone', 'sdPlayerOverlord', 'sdTurret' , 'sdCube', 'sdDrone', 'sdCommandCentre', 'sdSetrDestroyer', 'sdOverlord', 'sdSpider' ] );
		for ( let i = 0; i < targets_raw.length; i++ )
		{
			i = Math.round( Math.random() * targets_raw.length ); // Randomize it
			return targets_raw[ i ];
		}*/
		
		/* let e = sdEntity.GetRandomEntity();
		
		if ( sdCom.com_faction_attack_classes.indexOf( e.GetClass() ) !== -1 )
		if ( e.IsVisible( this ) )
		if ( e.IsTargetable( this ) )
		if ( this.CanAttackEnt( e ) )
		{
			return e;
		} */
		
		return null;
	}
	FindVestroidNearby()
	{
		let closest = null;
		let closest_di = Infinity;

		for ( let i = 0; i < sdVestroid.all_vestroids.length; i++ )
		{
			let ent = sdVestroid.all_vestroids[ i ];

			if ( ent !== this )
			{
				let di = sdWorld.Dist2D_Vector_pow2( ent.x - this.x, ent.y - this.y );
	
				if ( di < closest_di )
				{
					closest = ent;
					closest_di = di;
				}
			}
		}

		return closest;
	}
	Damage( dmg, initiator=null )
	{
		if ( !sdWorld.is_server )
		return;
	
		if ( initiator )
		if ( initiator._is_being_removed )
		initiator = null;
	
		if ( initiator )
		{
			// if ( this._ai_team !== initiator._ai_team )
			if ( !initiator.is( sdVestroid ) )
			if ( sdWorld.time > this._last_damage + 100 )
			if ( !this._current_target || Math.random() * this.hea / this.hmax < 0.25 )
			{
				this.SetTarget( initiator );

				for ( let i = 0; i < sdVestroid.all_vestroids.length; i++ )
				{
					if ( Math.random() * this.hea / this.hmax < 0.1 ) // Allies come to aid more often when health is low
					{
						let ent = sdVestroid.all_vestroids[ i ];
	
						if ( ent._current_target !== initiator )
						if ( sdWorld.inDist2D_Boolean( this.x, this.y, ent.x, ent.y, sdVestroid.attack_range ) )
						ent._current_target = initiator;
					}
				}
			}
		}



		dmg = Math.abs( dmg );
		
		let old_hp = this.hea;
		
		let was_alive = this.hea > 0;
		
		this.hea -= dmg;
		
		// if ( this.hea > 0 )
		{
			if ( Math.ceil( this.hea / this.hmax * 10 ) !== Math.ceil( old_hp / this.hmax * 10 ) )
			{
				sdSound.PlaySound({ name:'enemy_mech_hurt', x:this.x, y:this.y, volume:3, pitch: 0.7 });
			}
			
			if ( sdWorld.time > this._last_damage + 50 )
			{
				this._last_damage = sdWorld.time;
				sdSound.PlaySound({ name:'world_hit', x:this.x, y:this.y, pitch:0.5, volume:Math.min( 1, dmg / 200 ) });
			}
			
			//if ( this.hea <= 400 )
			//sdSound.PlaySound({ name:'hover_lowhp', x:this.x, y:this.y, volume:1 });
		}
		
		this._regen_timeout = Math.max( this._regen_timeout, 30 * 5 );
		
		if ( this.hea <= 0 && was_alive )
		if ( this._current_target )
		if ( this.type === sdVestroid.TYPE_DRONE )
		{
			if ( this.x > this._current_target.x )
			this.side = 1;
			else
			this.side = -1;

			this._hover = Math.random() < 0.5 ? 1 : 0.5;

			this.look_x = this._current_target.x + ( this._current_target.x - this.x ) * 10;
			this.look_y = this._current_target.y + ( this._current_target.y - this.y ) * 10;
		}

		//if ( this.hea < -this._hmax / 80 * 100 )
		//this.remove();
	}
	
	get mass() { return this.type === sdVestroid.TYPE_GUNSHIP ? 800 : this.type === sdVestroid.TYPE_DRONE ? 400 : 1200; }
	Impulse( x, y )
	{
		this.sx += x / ( this.mass );
		this.sy += y / ( this.mass );
	}
	/*Impact( vel ) // fall damage basically
	{
		// less fall damage
		if ( vel > 10 )
		{
			this.DamageWithEffect( ( vel - 4 ) * 15 );
		}
	}*/
	onThink( GSPEED ) // Class-specific, if needed
	{
		/*let pathfinding_result = null;
		
		// It makes sense to call it at all times because it also handles wall attack logic
		if ( this._current_target )
		pathfinding_result = this._pathfinding.Think( GSPEED );*/
		
		this.sx = sdWorld.MorphWithTimeScale( this.sx, 0, 0.88, GSPEED );
		this.sy = sdWorld.MorphWithTimeScale( this.sy, 0, 0.88, GSPEED );

		if ( this.hea <= 0 )
		{
			this._hover = ( this._hover + GSPEED / ( 15 ) ) % 1;
			
			this.tilt = sdWorld.MorphWithTimeScale( this.tilt, 0, 0.93, GSPEED );
			
			if ( this.hea <= 0 )
			this._time_until_full_remove -= GSPEED;

			if ( this._time_until_full_remove <= 0 || 
				( this.type === sdVestroid.TYPE_DRONE && !this.CanMoveWithoutOverlap( this.x + this.sx, this.y + this.sy, -1 ) ) || 
				( this.type === sdVestroid.TYPE_GUNSHIP && this.hea < -400 ) )
			{
				if ( sdWorld.is_server )
				{
					sdSound.PlaySound({ name:'enemy_mech_death3', x:this.x, y:this.y, volume:2 });
					
					sdSound.PlaySound({ name:'hover_explosion', x:this.x, y:this.y, volume:2 });
					//this.death_anim = 1;
					//if ( initiator )
					this.GiveScoreToLastAttacker( sdEntity.SCORE_REWARD_FREQUENTLY_LETHAL_MOB );
	
					// sdWorld.SpawnGib( this.x - (6 * this.side ), this.y + this._hitbox_y1, this.sx + Math.random() * 1 - Math.random() * 1, this.sy + Math.random() * 1 - Math.random() * 1, this.side, sdGib.CLASS_VESTROID_PARTS , this.filter, null );
					// sdWorld.SpawnGib( this.x + (12 * this.side ), this.y + this._hitbox_y2 + 6, this.sx + Math.random() * 1 - Math.random() * 1, this.sy + Math.random() * 2, this.side, sdGib.CLASS_VESTROID_PARTS , this.filter, null );

					let offsets = 
						this.type === sdVestroid.TYPE_GUNSHIP ? [ -28,6, -8,-12, 4,10, 28,4 ] : 
																[ -10,-10, 10,-10, -8,8, 8,10 ]; // x, y...

					let side = this.type === sdVestroid.TYPE_DRONE ? this.side : 1;

					let gib_class = 
						this.type === sdVestroid.TYPE_GUNSHIP ? sdGib.CLASS_VESTROID_GUNSHIP_PARTS : 
						sdGib.CLASS_VESTROID_DRONE_PARTS;

						let spawn_drones = this.type === sdVestroid.TYPE_GUNSHIP && this._time_until_full_remove <= 0;

					if ( !spawn_drones )
					for ( let i = 0; i < 4; i++ )
					sdWorld.SpawnGib( this.x + offsets[ i*2 ] * side, this.y + offsets[ i*2 + 1 ], 
						this.sx + Math.random() * 1 - 0.5, this.sy + Math.random() * 1 - 0.5,
						this.side, gib_class, null, null, 100, this, i );

					let that = this;
	
					let radius = ( this.type === sdVestroid.TYPE_GUNSHIP ? 70 : 40 );
	
					for ( let i = 0; i < 10; i++ )
					{
						var a = Math.random() * 2 * Math.PI;
						var s = Math.random() * 10;
	
						var k = 1;
	
						var x = that.x + that._hitbox_x1 + Math.random() * ( that._hitbox_x2 - that._hitbox_x1 );
						var y = that.y + that._hitbox_y1 + Math.random() * ( that._hitbox_y2 - that._hitbox_y1 );
	
						sdWorld.SendEffect({ x: x, y: y, type:sdEffect.TYPE_ROCK, sx: that.sx*k + Math.sin(a)*s, sy: that.sy*k + Math.cos(a)*s });
					}
					sdWorld.SendEffect({ 
						x: that.x,// + ( that._hitbox_x2 - that._hitbox_x1 ) / 2, 
						y: that.y,// + ( that._hitbox_y2 - that._hitbox_y1 ) / 2, 
						radius: radius, 
						damage_scale: spawn_drones ? 0 : radius * 0.25, 
						type: sdEffect.TYPE_EXPLOSION,
						owner: that,
						can_hit_owner: true,
						color: spawn_drones ? "#9ecaff" : sdEffect.default_explosion_color 
					});

					if ( spawn_drones )
					{
						for ( let i = 0; i < 2; i++ )
						{
							let ent = new sdVestroid({ x: this.x + ( i === 0 ? -28 : 28 ), y: this.y + 6, type: sdVestroid.TYPE_DRONE });

							sdEntity.entities.push( ent );

							if ( i === 0 )
							{
								ent.wea_type1 = this.wea_type1;

								ent._bullets_max1 = this._bullets_max1;
								ent._bullets1 = this._bullets1;

								ent.wea_an1 = this.wea_an1;

								if ( this._current_target && !this._current_target._is_being_removed )
								ent._current_target = this._current_target
							}
							else
							{
								ent.wea_type1 = this.wea_type2;
	
								ent._bullets_max1 = this._bullets_max2;
								ent._bullets1 = this._bullets2;
	
								ent.wea_an1 = this.wea_an2;

								if ( this._current_target && !this._current_target._is_being_removed )
								ent._current_target = this._current_target
							}
						}
					}
	
					/*let r = Math.random();
					let shards = 2 + Math.round( Math.random() * 3);
			
					if ( r < 0.35 )
					{
						let x = this.x;
						let y = this.y;
						let sx = this.sx;
						let sy = this.sy;
	
						setTimeout(()=>{ // Hacky, without this gun does not appear to be pickable or interactable...
	
							let random_value = Math.random();
	
							let gun;
	
							//if ( random_value < 0.45 )
							//gun = new sdGun({ x:x, y:y, class:sdGun.CLASS_BUILDTOOL_UPG });
							//else
							{
								if ( random_value > 0.92 ) // ( random value < 0.08 ) couldn't occur because if it's below 0.5 it drops BT upgrade instead 
								gun = new sdGun({ x:x, y:y, class:sdGun.CLASS_FMECH_MINIGUN });
								else
								gun = new sdGun({ x:x, y:y, class:sdGun.CLASS_RAIL_CANNON });
							}
	
							gun.sx = sx;
							gun.sy = sy;
							sdEntity.entities.push( gun );
	
						}, 500 );
					}
					while ( shards > 0 )
					{
						let x = this.x;
						let y = this.y;
						let sx = this.sx;
						let sy = this.sy;
	
						setTimeout(()=>{ // Hacky, without this gun does not appear to be pickable or interactable...
	
							let random_value = Math.random();
	
							let gun;
	
							gun = new sdGun({ x:x, y:y, class:sdGun.CLASS_METAL_SHARD });
	
							gun.sx = sx + Math.random() - Math.random();
							gun.sy = sy + Math.random() - Math.random();
							sdEntity.entities.push( gun );
	
						}, 500 );
						shards--;
					}*/
					this.remove();
					return;
				}
			}
			else
			if ( this.type === sdVestroid.TYPE_DRONE )
			{
				if ( sdWorld.is_server )
				{
					if ( this._current_target )
					{
						let an = Math.atan2( this.look_y - this.y, this.look_x - this.x ) + Math.sin( this._hover * Math.PI * 2 );
	
						this._move_dir_x = Math.cos( an );
						this._move_dir_y = Math.sin( an );
					}
	
					let v = 0.2;
	
					this.sx += this._move_dir_x * ( v ) * this._move_speed * GSPEED;
					this.sy += this._move_dir_y * ( v ) * this._move_speed * GSPEED;
				}

				if ( !sdWorld.is_server || sdWorld.is_singleplayer )
				{
					this._smoke_spawn_wish += GSPEED;
					if ( this._smoke_spawn_wish > 1 )
					{
						this._smoke_spawn_wish = this._smoke_spawn_wish % 1;
						//this._smoke_spawn_wish -= 1;
						
						let ent = new sdEffect({ x: this.x, y: this.y, sy:-1, type:sdEffect.TYPE_GLOW_HIT, color:'#666666' });
						sdEntity.entities.push( ent );
					}
				}
			}
			else
			if ( this.type === sdVestroid.TYPE_GUNSHIP )
			{
				this.sy += sdWorld.gravity * 0.1 * GSPEED;
			}
		}
		else
		{
			this._hover = ( this._hover + GSPEED / ( this.mass / 6 ) ) % 1;
			

			if ( sdWorld.is_server )
			{
				if ( !this._follow_target || this._follow_target._is_being_removed || Math.random() < 0.1 * GSPEED )
				{
					// this._follow_target = null;

					this._follow_target = this.FindVestroidNearby();
				
					//this._follow_target = this.GetRandomEntityNearby();
				}

				if ( this._regen_timeout <= 0 )
				if ( this.hea < this.hmax ) 
				this.hea += GSPEED; // Give them health regen if not taking damage over min
				if ( this._regen_timeout > 0 )
				this._regen_timeout -= GSPEED;

				if ( this._move_dir_timer <= 0 )
				{
					this._move_dir_timer = 20;

					let closest = this._current_target;
					if ( !closest || closest._is_being_removed || 
						 ( closest.hea || closest._hea || 0 ) <= 0 || 
						 closest._respawn_protection !== undefined && closest._respawn_protection > 0 || // Stop targeting players after RTP use
						 !sdWorld.inDist2D_Boolean( this.x, this.y, closest.x, closest.y, sdVestroid.seek_range ) )
					{
						closest = this.GetRandomEntityNearby();
					}

					this.SetTarget( closest );

					if ( !closest && this._follow_target )
					{
						closest = this._follow_target;
					}
					
					if ( closest )
					{
						/*let travel_speed = 6;

						let di = sdWorld.Dist2D( this.x, this.y, closest.x, closest.y );
						if ( di < 0.05 )
						di = 1;

						if ( pathfinding_result )
						{
							if ( pathfinding_result.attack_target )
							if ( di < sdVestroid.attack_range )
							{
								let an = Math.random() * Math.PI * 2;

								this._move_dir_x = Math.cos( an );
								this._move_dir_y = Math.sin( an );
							}
							else
							if ( sdWorld.CheckLineOfSight( this.x, this.y, this.x + pathfinding_result.act_x * 100, this.y + pathfinding_result.act_y * 100, this, sdCom.com_visibility_ignored_classes, null ) )
							{
								this._move_dir_x = pathfinding_result.act_x * travel_speed;
								this._move_dir_y = pathfinding_result.act_y * travel_speed;
								sdWorld.SendEffect({ x:this.x, y:this.y, x2:this.x + pathfinding_result.act_x * 100, y2:this.y + pathfinding_result.act_y * 100, type:sdEffect.TYPE_BEAM, color:"#00ff00" })
							}
							else
							{
								this._move_dir_x = pathfinding_result.act_y * travel_speed;
								this._move_dir_y = pathfinding_result.act_x * travel_speed;
							}
						}
						else
						{
							let an_desired = Math.atan2( closest.y - this.y, closest.x - this.x ) - 0.5 + Math.random();

							this._move_dir_x = Math.cos( an_desired ) * travel_speed;
							this._move_dir_y = Math.sin( an_desired ) * travel_speed;
							sdWorld.SendEffect({ x:this.x, y:this.y, x2:this.x + this._move_dir_x * 100, y2:this.y + this._move_dir_y * 100, type:sdEffect.TYPE_BEAM, color:"#ff0000" })
						}*/

						if ( this.x > closest.x )
						this.side = 1;
						else
						this.side = -1;

						let an_desired = Math.atan2( closest.y - this.y, closest.x - this.x ) + ( Math.random() * 2 - 1 ) * 0.1;

						this._move_dir_x = Math.cos( an_desired );
						this._move_dir_y = Math.sin( an_desired );

						let bound = 100;

						let in_range = sdWorld.inDist2D_Boolean( this.x, this.y, closest.x, closest.y, sdVestroid.attack_range ); // close enough to dodge obstacles

						if ( in_range || 
							 !sdWorld.CheckLineOfSight( this.x, this.y, 
														this.x + Math.cos( an_desired ) * bound, 
														this.y + Math.sin( an_desired ) * bound, this, sdCom.com_visibility_ignored_classes, null ) )
						{
							if ( this.type === sdVestroid.TYPE_TURRET )
							{
							}
							{
								this._move_dir_x = ( Math.random() * 2 - 1 );
								this._move_dir_y = Math.sin( this._hover * Math.PI * 2 );
	
								if ( !this.CanMoveWithoutOverlap( this.x + this._move_dir_x * 32, this.y + this._move_dir_y * 32, -1 ) )
								if ( sdWorld.last_hit_entity )
								{
									let an = Math.atan2( this.y - sdWorld.last_hit_entity.y, this.x - sdWorld.last_hit_entity.x );
	
									this._move_dir_x = Math.cos( an );
									this._move_dir_y = Math.sin( an );
								}
							}

							// if ( sdWorld.CheckLineOfSight( this.x, this.y, this.x + this._move_dir_x * 100, this.y + this._move_dir_y * 100, this, sdCom.com_visibility_ignored_classes, null ) )
							if ( !in_range )
							{
								for ( let ideas = Math.max( 5, 40 / sdVestroid.all_vestroids.length ); ideas > 0; ideas-- )
								{
									var a1 = Math.random() * Math.PI * 2;
									var r1 = Math.random() * 200;
									
									let x1 = this.x + Math.cos( a1 ) * r1;
									let y1 = this.y + Math.sin( a1 ) * r1;

									//var a2 = Math.random() * Math.PI * 2;
									//var r2 = Math.random() * 200;

									if ( sdWorld.CheckLineOfSight( this.x, this.y, x1, y1, this, sdCom.com_visibility_ignored_classes, null ) )
									{
										if ( sdWorld.CheckLineOfSight( x1, y1, 
																	   x1 + Math.cos( an_desired ) * ( r1 + bound / 2 ), 
																	   y1 + Math.sin( an_desired ) * ( r1 + bound / 2 ), this, sdCom.com_visibility_ignored_classes, null ) )
										if ( sdWorld.Dist2D( this.x + Math.cos( an_desired ) * bound / 2, 
															 this.y + Math.sin( an_desired ) * bound / 2, closest.x, closest.y ) > 
											 sdWorld.Dist2D( x1 + Math.cos( an_desired ) * r1, 
															 y1 + Math.sin( an_desired ) * r1, closest.x, closest.y ) ) // New position is closer than old
										{
											// Can attack from position 1

											this._move_dir_x = Math.cos( a1 );
											this._move_dir_y = Math.sin( a1 );

											this._move_dir_timer = r1 * 5 / this._move_speed;

											sdWorld.SendEffect({ x:this.x, y:this.y, x2:x1, y2:y1, type:sdEffect.TYPE_BEAM });
											break;

										}
									}
								}
							}
						}
					}
					else
					{
						this._move_dir_x = ( Math.random() * 2 - 1 );
						this._move_dir_y = Math.sin( this._hover * Math.PI * 2 );
					}
				}
				else
				this._move_dir_timer -= GSPEED;
			}
		
			let v = 0.05;
			
			this.sx += this._move_dir_x * ( v ) * this._move_speed * GSPEED;
			this.sy += this._move_dir_y * ( v ) * this._move_speed * GSPEED;
			this.tilt = sdWorld.MorphWithTimeScale( this.tilt, this._move_dir_x * this._move_speed * 4, 0.93, GSPEED );

			if ( sdWorld.is_server )
			{
				let from_entity = this._current_target;

				if ( from_entity )
				{
					let xx = from_entity.x + ( from_entity._hitbox_x1 + from_entity._hitbox_x2 ) / 2;
					let yy = from_entity.y + ( from_entity._hitbox_y1 + from_entity._hitbox_y2 ) / 2;
	
					this.look_x = xx;
					this.look_y = yy;
				}

				let attacking1 = this._attack_timer1 <= 0;
				let attacking2 = this._attack_timer2 <= 0;

				let target = this._current_target;

				if ( target && !target._is_being_removed )
				{
					if ( attacking1 )
					this.FireWeapon( 0, target );

					if ( this.type === sdVestroid.TYPE_GUNSHIP )
					if ( attacking2 )
					this.FireWeapon( 1, target );
				}

				if ( !attacking1 )
				this._attack_timer1 -= GSPEED;

				if ( this.type === sdVestroid.TYPE_GUNSHIP )
				if ( !attacking2 )
				this._attack_timer2 -= GSPEED;
				//if ( this._rocket_time_until_attack > 0)
				//this._rocket_time_until_attack -= GSPEED;
			}
		
			// if ( this.attack_anim > 0 )
			// this.attack_anim = Math.max( 0, this.attack_anim - GSPEED );
		
			this.PhysWakeUp();
		}
		
		/*if ( this._alert_intensity > 0 )
		if ( this._alert_intensity < 45 )
		{
			this._alert_intensity += GSPEED;
		}*/
			
		this.ApplyVelocityAndCollisions( GSPEED, 0, true );
	}
	
	static IsTargetFriendly( ent ) // It targets players and turrets regardless
	{
	
		return false;
	}
	
	DrawHUD( ctx, attached ) // foreground layer
	{
		if ( this.type === sdVestroid.TYPE_GUNSHIP )
		sdEntity.Tooltip( ctx, "Vestroid Gunship", 0, -30 );
		else
		if ( this.type === sdVestroid.TYPE_DRONE )
		sdEntity.Tooltip( ctx, "Vestroid Drone", 0, -30 );
		else
		sdEntity.Tooltip( ctx, "Vestroid Turret", 0, -30 );
		
		this.DrawHealthBar( ctx, undefined, 10 );
	}
	Draw( ctx, attached )
	{
		ctx.filter = this.filter;

		if ( this.type === sdVestroid.TYPE_GUNSHIP )
		{
			ctx.rotate( this.tilt / 100 );

			ctx.drawImageFilterCache( sdVestroid.img_vestroid, 0,0, 96,64, -48,-32, 96,64 );

			ctx.save();

			ctx.translate( -35, 14 );

			ctx.rotate( this.wea_an1 / 100 );
			ctx.scale( 1, -this.side );

			ctx.drawImageFilterCache( sdVestroid.img_vestroid, 32 * 3,this.wea_type1 * 32, 32,32, -16 + 8,-16, 32,32 );

			ctx.restore();

			ctx.translate( 35, 14 );

			ctx.rotate( this.wea_an2 / 100 );
			ctx.scale( 1, -this.side );

			ctx.drawImageFilterCache( sdVestroid.img_vestroid, 32 * 3,this.wea_type2 * 32, 32,32, -16 + 8,-16, 32,32 );
		}
		else
		if ( this.type === sdVestroid.TYPE_DRONE )
		{
			ctx.scale( this.side, 1 );

			ctx.rotate( this.tilt / 100 * this.side );

			ctx.drawImageFilterCache( sdVestroid.img_vestroid, 0,64 + 32, 64,32, -32,-8, 64,32 );

			ctx.rotate( this.tilt / 100 * -this.side * 0.5 );

			ctx.drawImageFilterCache( sdVestroid.img_vestroid, 0,64, 64,32, -32,-16 - 8, 64,32 );

			ctx.translate( 0, 16 );

			ctx.rotate( this.wea_an1 / 100 * this.side );
			ctx.scale( this.side, -this.side );

			ctx.drawImageFilterCache( sdVestroid.img_vestroid, 32 * 3,this.wea_type1 * 32, 32,32, -16 + 8,-16, 32,32 );
		}

		ctx.globalAlpha = 1;
		ctx.filter = 'none';
		ctx.sd_filter = null;
	}
	
	onRemoveAsFakeEntity()
	{
		sdVestroid.all_vestroids.splice( sdVestroid.all_vestroids.indexOf( this ), 1 );
	}
	/*onMovementInRange( from_entity )
	{
		//this._last_stand_on = from_entity;
	}*/
	onRemove() // Class-specific, if needed
	{
		this.onRemoveAsFakeEntity();
		
		if ( this._broken )
		{
			sdWorld.BasicEntityBreakEffect( this, 25, 3, 0.75, 0.75 );
			//sdSound.PlaySound({ name:'crystal', x:this.x, y:this.y, volume:1 });
			sdWorld.DropShards( this.x, this.y, 0, 0, 
				Math.floor( Math.max( 0, this.matter / 5120 * 40 / sdWorld.crystal_shard_value * 0.5 ) ),
				5120 / 40
			);
		}
	}
	MeasureMatterCost()
	{
		return 0; // Hack
	}
}
//sdEnemyMech.init_class();

export default sdVestroid;
