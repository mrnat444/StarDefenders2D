/*

	Status effects that are attached to other entities. These are capable of modifying how entities look.

	These can maybe even work as held item containers + multipliers? If these will work well across long-range teleporters.

*/
import sdWorld from '../sdWorld.js';
import sdEntity from './sdEntity.js';
import sdEffect from './sdEffect.js';
import sdBullet from './sdBullet.js';

import sdRenderer from '../client/sdRenderer.js';

class sdStatusEffect extends sdEntity
{
	static init_class()
	{
		sdWorld.entity_classes[ this.name ] = this; // Register for object spawn
		
		//sdStatusEffect.img_red_arrow = sdWorld.CreateImageFromFile( 'task_offscreen' );
		
		sdStatusEffect.types = [];
		
		sdStatusEffect.types[ sdStatusEffect.TYPE_DAMAGED = 0 ] = 
		{
			remove_if_for_removed: false,
	
			is_emote: false,
	
			onMade: ( status_entity, params )=>
			{
				status_entity._progress = 0;
				status_entity._max_progress = 700 / 30;
				
				status_entity.merges = 0; // To make it more smooth - client will automatically reset _progress when merge count goes up
				status_entity._last_merges = 0;
				
				status_entity.dmg = params.dmg || 0;
				
				status_entity._observers = new WeakSet(); // Damage initiators
				
				if ( params.by )
				status_entity._observers.add( params.by );
				
				//status_entity._progress = 100 / 1000 * 30;
			},
			onStatusOfSameTypeApplied: ( status_entity, params )=> // status_entity is an existing status effect entity
			{
				status_entity.dmg += params.dmg || 0;

				status_entity.merges++;

				status_entity._update_version++;

				return true; // Cancel merge process
			},
			onStatusOfDifferentTypeApplied: ( status_entity, params )=> // status_entity is an existing status effect entity
			{
				return false; // Do not stop merge process
			},
			IsVisible: ( status_entity, observer_entity )=>
			{
				//return true;
				return ( observer_entity === status_entity.for || status_entity._observers.has( observer_entity ) );
			},
			onThink: ( status_entity, GSPEED )=>
			{
				if ( status_entity._last_merges !== status_entity.merges )
				{
					status_entity._last_merges = status_entity.merges;
					status_entity._progress = 0;
				}
				else
				{
					status_entity._progress += GSPEED;
				}
			
				return ( status_entity._progress > status_entity._max_progress ); // return true = delete
			},
			onBeforeRemove: ( status_entity )=>
			{
			},
			onBeforeEntityRender: ( status_entity, ctx, attached )=>
			{
				if ( !status_entity.for )
				return;
				
				if ( status_entity._progress < 200 / 1000 * 30 )
				{
					if ( status_entity.dmg > 0 )
					{
						if ( status_entity.for.DrawIn3D() === FakeCanvasContext.DRAW_IN_3D_BOX )
						{
							ctx.sd_status_effect_tint_filter = [ 1.5, 1.5, 1.5 ];
						}
						else
						ctx.sd_status_effect_filter = { s:'ffffff' };
					}
					else
					{
						//ctx.sd_status_effect_filter = { s:'66ff66' };
						ctx.sd_status_effect_tint_filter = [ 0.75, 1.5, 0.75 ];
					}
				}
			},
			onAfterEntityRender: ( status_entity, ctx, attached )=>
			{
				ctx.sd_status_effect_filter = null;
				ctx.sd_status_effect_tint_filter = null;
			},
			DrawFG: ( status_entity, ctx, attached )=>
			{
				if ( status_entity.dmg === 0 )
				return;
			
				ctx.textAlign = 'center';
				ctx.font = "5px Verdana";
				
				/*for ( let sh = 0; sh < 1; sh++ )
				for ( let x = -1; x <= 1; x++ )
				for ( let y = -1; y <= 1; y++ )*/
				{
					//if ( x === 0 && y === 0 )
					{
						//if ( sh !== 1 )
						//continue;
					
						if ( status_entity.dmg > 200 )
						ctx.fillStyle = '#ff0000';
						else
						if ( status_entity.dmg > 100 )
						ctx.fillStyle = '#ff6666';
						else
						if ( status_entity.dmg > 50 )
						ctx.fillStyle = '#ffaaaa';
						else
						if ( status_entity.dmg > 0 )
						ctx.fillStyle = '#ffeeee';
						else
						ctx.fillStyle = '#aaffaa';
					}
					/*else
					{
						if ( sh !== 0 )
						continue;
					
						ctx.fillStyle = '#000000';
					}*/

					ctx.globalAlpha = Math.min( 1, ( 1 - status_entity._progress / status_entity._max_progress ) * 2 );
					
					let xx = 0;
					let yy = -2.5 - status_entity._progress * 1 + Math.pow( status_entity._progress, 2 ) * 0.1;

					if ( status_entity.dmg > 0 )
					ctx.fillText( status_entity.dmg + '', xx, yy );
					else
					ctx.fillText( '+' + Math.abs( status_entity.dmg ) + '', xx, yy ); 

				}
				
				ctx.globalAlpha = 1;
			}
		};
		
		sdStatusEffect.types[ sdStatusEffect.TYPE_HEARTS = 1 ] = 
		{
			is_emote: true, // Used as a sign for removal with context option
	
			onMade: ( status_entity, params )=>
			{
				//trace('-- Hearts made');
				
				status_entity._ttl = 0; // 0 = permanent
				status_entity._next_spawn = 0;
				
				status_entity._effects = [];
				
				if ( params.ttl !== undefined )
				status_entity._ttl = params.ttl;
			},
			onStatusOfSameTypeApplied: ( status_entity, params )=> // status_entity is an existing status effect entity
			{

				return true; // Cancel merge process
			},
			
			onThink: ( status_entity, GSPEED )=>
			{
				if ( !sdWorld.is_server || sdWorld.is_singleplayer )
				if ( status_entity.for.hea > 0 )
				{
					status_entity._next_spawn -= GSPEED;
					
					const up_velocity = -0.1;
					const y_offset = status_entity.for._hitbox_y1 + 3;
					const range = 16;
					const range_affection = 16;

					if ( status_entity._next_spawn <= 0 )
					{
						status_entity._next_spawn = 5 + Math.random() * 10;

						let a = Math.random() * Math.PI * 2;

						let r = Math.pow( Math.random(), 0.5 ) * range;

						let xx = status_entity.for.x + Math.sin( a ) * r;
						let yy = status_entity.for.y + y_offset + Math.cos( a ) * r;

						let ent = new sdEffect({ x: xx, y: yy, type:sdEffect.TYPE_HEARTS, sx: 0, sy: up_velocity });
						sdEntity.entities.push( ent );
						
						status_entity._effects.push( ent );
					}
					
					while ( status_entity._effects.length > 0 && status_entity._effects[ 0 ]._is_being_removed )
					status_entity._effects.shift();
				
					for ( let i = 0; i < status_entity._effects.length; i++ )
					{
						let ent = status_entity._effects[ i ];
						
						let di = sdWorld.inDist2D( ent.x, ent.y, status_entity.for.x, status_entity.for.y + y_offset, range_affection );
						
						if ( di >= 0 )
						{
							ent.sx = sdWorld.MorphWithTimeScale( ent.sx, status_entity.for.sx, 0.95, GSPEED * ( range_affection - di ) );
							ent.sy = sdWorld.MorphWithTimeScale( ent.sy, status_entity.for.sy + up_velocity, 0.95, GSPEED * ( range_affection - di ) );
						}

						ent.sx = sdWorld.MorphWithTimeScale( ent.sx, 0, 0.95, GSPEED );
						ent.sy = sdWorld.MorphWithTimeScale( ent.sy, up_velocity, 0.95, GSPEED );
					}
				}
				
				if ( status_entity._ttl > 0 )
				{
					status_entity._ttl -= GSPEED;

					return ( status_entity._ttl <= 0 ); // return true = delete
				}
				
				return false; // Keep
			}
		};
		
		sdStatusEffect.types[ sdStatusEffect.TYPE_FIRE = 2 ] = 
		{
			is_emote: false, // Not emote option
	
			onMade: ( status_entity, params )=>
			{
				//trace('-- You are on fire');
				
				status_entity._ttl = 30 * 6; // 6 seconds
				status_entity._next_spawn = 0;
				status_entity._next_damage = 10;
				
				status_entity._effects = [];
				
				if ( params.ttl !== undefined )
				status_entity._ttl = params.ttl;
			},
			onStatusOfSameTypeApplied: ( status_entity, params )=> // status_entity is an existing status effect entity
			{
				status_entity._ttl = 30 * 6; // 6 seconds
				return true; // Fire should perhaps stack?
			},
			
			onThink: ( status_entity, GSPEED )=>
			{
				if ( !sdWorld.is_server || sdWorld.is_singleplayer )
				//if ( status_entity.for.hea > 0 )
				{
					status_entity._next_spawn -= GSPEED;					
					const up_velocity = -0.4;
					const y_offset = 8;
					const range = 8;
					const range_affection = 8;

					if ( status_entity._next_spawn <= 0 )
					{
						status_entity._next_spawn = 5 + Math.random() * 10;

						let a = Math.random() * Math.PI * 2;

						let r = Math.pow( Math.random(), 0.5 ) * range;

						let xx = status_entity.for.x + Math.sin( a ) * r;
						let yy = status_entity.for.y + y_offset + Math.cos( a ) * r;

						let ent = new sdEffect({ x: xx, y: yy, type:sdEffect.TYPE_GLOW_HIT, sx: 0, sy: up_velocity, color:'#FFAA33' });
						sdEntity.entities.push( ent );

						status_entity._effects.push( ent );


						//let ent2 = new sdEffect({ x: xx, y: yy, type:sdEffect.TYPE_GIB_GREEN, sx: 0, sy: up_velocity, filter:'hue-rotate(-90deg) saturate(1.5)' });
						//sdEntity.entities.push( ent2 ); // I don't think this looks good. - Booraz149

						//status_entity._effects.push( ent2 );

					}
					
					while ( status_entity._effects.length > 0 && status_entity._effects[ 0 ]._is_being_removed )
					status_entity._effects.shift();
				
					for ( let i = 0; i < status_entity._effects.length; i++ )
					{
						let ent = status_entity._effects[ i ];
						
						let di = sdWorld.inDist2D( ent.x, ent.y, status_entity.for.x, status_entity.for.y + y_offset, range_affection );
						
						if ( di >= 0 )
						{
							ent.sx = sdWorld.MorphWithTimeScale( ent.sx, status_entity.for.sx, 0.95, GSPEED * ( range_affection - di ) );
							ent.sy = sdWorld.MorphWithTimeScale( ent.sy, status_entity.for.sy + up_velocity, 0.95, GSPEED * ( range_affection - di ) );
						}

						ent.sx = sdWorld.MorphWithTimeScale( ent.sx, 0, 0.95, GSPEED );
						ent.sy = sdWorld.MorphWithTimeScale( ent.sy, up_velocity, 0.95, GSPEED );
					}
				}
				if ( sdWorld.is_server )
				{
					status_entity._next_damage -= GSPEED;
					if ( status_entity._next_damage <= 0 )
					{
						status_entity._next_damage = 10;
						status_entity.for.DamageWithEffect( 2 );
					}
				}
				if ( status_entity._ttl > 0 )
				{
					status_entity._ttl -= GSPEED;

					return ( status_entity._ttl <= 0 ); // return true = delete
				}
				
				return false; // Keep
			}
		};

		sdStatusEffect.status_effects = [];
		
		sdStatusEffect.entity_to_status_effects = new WeakMap(); // entity => [ eff1, eff2 ... ].inversed = [ ... eff2, eff1 ]
		
		//sdStatusEffect.line_of_sight_visibility_cache = new WeakMap(); // entity => { next_update_time, result, result_soft, lx, ly }
	}
	static DrawEffectsFor( entity, destination, start0_end1, ctx, attached ) // destination: 0 = BG, 1 = Normal, 2 = FG
	{
		let arr = sdStatusEffect.entity_to_status_effects.get( entity );
		if ( arr !== undefined )
		{
			if ( start0_end1 === 1 )
			arr = arr.inversed;
			
			for ( let i = 0; i < arr.length; i++ )
			{
				let type = sdStatusEffect.types[ arr[ i ].type ];
				
				if ( type )
				{
					//console.warn('destination: '+destination+', start0_end1: ' + start0_end1);
		
					if ( start0_end1 === 0 )
					{
						if ( type.onBeforeEntityRender )
						type.onBeforeEntityRender( arr[ i ], ctx, attached );
					}
					else
					{
						if ( type.onAfterEntityRender )
						type.onAfterEntityRender( arr[ i ], ctx, attached );
					}
					
					if ( destination === 0 && start0_end1 === 1 )
					if ( type.DrawBG )
					type.DrawBG( arr[ i ], ctx, attached );
			
					if ( destination === 1 && start0_end1 === 1 )
					if ( type.Draw )
					type.Draw( arr[ i ], ctx, attached );
			
					if ( destination === 2 && start0_end1 === 1 )
					if ( type.DrawFG )
					type.DrawFG( arr[ i ], ctx, attached );
				}
			}
		}
		
		/* Line of sight test. Not the best looking one
		if ( sdWorld.my_entity )
		{
			if ( start0_end1 === 0 )
			{
				let cache = sdStatusEffect.line_of_sight_visibility_cache.get( entity );
				
				if ( !cache )
				{
					let instant = entity.is( sdEffect ) || entity.is( sdBullet );
					
					cache = { next_update_time: instant ? 0 : ( sdWorld.time + Math.random() * 100 ), result:0, result_soft:0, lx:Math.random(), ly:Math.random() };
					sdStatusEffect.line_of_sight_visibility_cache.set( entity, cache );
				}
				
				if ( cache.next_update_time < sdWorld.time )
				{
					let r = 0;
							
					let x,y;
					
					if ( cache.result === 1 )
					{
						x = cache.lx;
						y = cache.ly;
					}
					else
					{
						// Only place point on edges
						if ( Math.random() < 0.5 )
						{
							x = cache.lx = 0.01 + Math.random() * 0.98;
							y = cache.ly = 0.01 + ( Math.random() < 0.5 ? 0 : 1 ) * 0.98;
						}
						else
						{
							x = cache.lx = 0.01 + ( Math.random() < 0.5 ? 0 : 1 ) * 0.98;
							y = cache.ly = 0.01 + Math.random() * 0.98;
						}
					}
					
					//both:
					//for ( let x = 0.01; x < 1; x += 0.98 )
					//for ( let y = 0.01; y < 1; y += 0.98 )
					{
						//if ( sdWorld.CheckLineOfSight( entity.x + entity._hitbox_x1 + x * ( entity._hitbox_x2 + entity._hitbox_x1 ), entity.y + entity._hitbox_y1 + y * ( entity._hitbox_y2 + entity._hitbox_y1 ), sdWorld.my_entity.x, sdWorld.my_entity.y, entity, null, sdCom.com_visibility_unignored_classes, null ) || sdWorld.last_hit_entity === sdWorld.my_entity || sdWorld.last_hit_entity === sdWorld.my_entity.driver_of )
						if ( sdWorld.CheckLineOfSight( 
								sdWorld.my_entity.x, 
								sdWorld.my_entity.y, 
								entity.x + entity._hitbox_x1 + x * ( entity._hitbox_x2 + entity._hitbox_x1 ), 
								entity.y + entity._hitbox_y1 + y * ( entity._hitbox_y2 + entity._hitbox_y1 ), 
								sdWorld.my_entity, null, sdCom.com_vision_blocking_classes, null ) || sdWorld.last_hit_entity === entity )
						{
							r = 1;
							//break both;
						}
						//ctx.sd_status_effect_filter = { s:'000000' };
					}
					cache.result = r;
					
					if ( r )
					cache.next_update_time = sdWorld.time + 2000 + Math.random() * 1000;
					else
					cache.next_update_time = sdWorld.time + 500 + Math.random() * 500;
					
				}
				
				if ( cache.result_soft < cache.result )
				cache.result_soft = Math.min( cache.result_soft + 0.075, cache.result );
				else
				if ( cache.result_soft > cache.result )
				cache.result_soft = Math.max( cache.result_soft - 0.02, cache.result );
		
				if ( ctx.sd_status_effect_tint_filter )
				{
					ctx.sd_status_effect_tint_filter[ 0 ] *= cache.result_soft;
					ctx.sd_status_effect_tint_filter[ 1 ] *= cache.result_soft;
					ctx.sd_status_effect_tint_filter[ 2 ] *= cache.result_soft;
				}
				else
				{
					ctx.sd_status_effect_tint_filter = [ cache.result_soft, cache.result_soft, cache.result_soft ];
				}
			}
			else
			{
				ctx.sd_status_effect_tint_filter = null;
			}
		}*/
	}
	
	
	static WakeUpStatusEffectsFor( character )
	{
		// TODO: Optimzie using map (though map is delayed and can cause other issues?)
		
		for ( let i = 0; i < sdStatusEffect.status_effects.length; i++ )
		{
			if ( sdStatusEffect.status_effects[ i ].for === character )
			if ( !sdStatusEffect.status_effects[ i ]._is_being_removed )
			sdStatusEffect.status_effects[ i ].SetHiberState( sdEntity.HIBERSTATE_ACTIVE );
		}
	}
	
	static PerformActionOnStatusEffectsOf( character, action )
	{
		// TODO: Optimzie using map (though map is delayed and can cause other issues?)
		
		for ( let i = 0; i < sdStatusEffect.status_effects.length; i++ )
		{
			if ( sdStatusEffect.status_effects[ i ].for === character )
			if ( !sdStatusEffect.status_effects[ i ]._is_being_removed )
			action( sdStatusEffect.status_effects[ i ] );
		}
	}
	
	static ApplyStatusEffectForEntity( params )
	{
		// TODO: Optimzie using map (though map is delayed and can cause other issues?)
		
		for ( let i = 0; i < sdStatusEffect.status_effects.length; i++ )
		{
			let old_status = sdStatusEffect.status_effects[ i ];
			
			if ( old_status.for === params.for )
			{
				let status_type = sdStatusEffect.types[ old_status.type ];
		
				if ( status_type )
				{
					if ( old_status.type === params.type )
					{
						if ( status_type.onStatusOfSameTypeApplied )
						if ( status_type.onStatusOfSameTypeApplied( old_status, params ) )
						return;
					}
					else
					{
						if ( status_type.onStatusOfDifferentTypeApplied )
						if ( status_type.onStatusOfDifferentTypeApplied( old_status, params ) )
						return;
					}
				}
			}
		}
	
		let task = new sdStatusEffect( params );
		sdEntity.entities.push( task );
	}
	
	IsVisible( observer_entity )
	{
		let type = sdStatusEffect.types[ this.type ];
		
		if ( type )
		if ( type.IsVisible )
		return type.IsVisible( this, observer_entity );
		
		if ( this.for && !this.for._is_being_removed )
		return this.for.IsVisible( observer_entity );
	
		return false;
	}
	
	ExtraSerialzableFieldTest( prop )
	{
		if ( prop === 'for' ) return true;
		
		return false;
	}
	
	GetStatusType()
	{
		return sdStatusEffect.types[ this.type ];
	}
	
	constructor( params )
	{
		super( params );
		
		this.for = params.for || null; // Target. Who has this status effect
		this._for_confirmed = false;

		this.type = params.type || 0;
		
		let status_type = sdStatusEffect.types[ this.type ];
		
		if ( status_type )
		{
			if ( status_type.onMade )
			status_type.onMade( this, params );
		
			if ( status_type.remove_if_for_removed === false )
			this.remove_if_for_removed = false;
			else
			this.remove_if_for_removed = true;
		}
		
		sdStatusEffect.status_effects.push( this );
	}
	
	onServerSideSnapshotLoaded() // Something like LRT will use this to reset phase on load
	{
		this._for_confirmed = false; // Reset this one since we need to update map
	}
	
	get hitbox_x1() { return 0; }
	get hitbox_x2() { return 0; }
	get hitbox_y1() { return 0; }
	get hitbox_y2() { return 0; }
	
	/*SyncedToPlayer( character ) // Shortcut for enemies to react to players
	{
	}*/
	
	get hard_collision()
	{ return false; }
	
	get is_static() // Static world objects like walls, creation and destruction events are handled manually. Do this._update_version++ to update these
	{ return true; }
	
	IsBGEntity() // Check sdEntity for meaning
	{ return 6; }
	
	
	onRemoveAsFakeEntity()
	{
		let status_type = sdStatusEffect.types[ this.type ];
		if ( status_type.onBeforeRemove )
		status_type.onBeforeRemove( this );
		
		sdStatusEffect.status_effects.splice( sdStatusEffect.status_effects.indexOf( this ), 1 );
		
		if ( this._for_confirmed )
		if ( this.for ) // Can be null if removed, which is fine
		{
			let arr = sdStatusEffect.entity_to_status_effects.get( this.for );
			
			arr.splice( arr.indexOf( this ), 1 );
			arr.inversed.splice( arr.inversed.indexOf( this ), 1 );
		}
	}
	onBeforeRemove()
	{
		let status_type = sdStatusEffect.types[ this.type ];
		if ( status_type.onBeforeRemove )
		status_type.onBeforeRemove( this );
	
		sdStatusEffect.status_effects.splice( sdStatusEffect.status_effects.indexOf( this ), 1 );
		
		if ( this._for_confirmed )
		if ( this.for ) // Can be null if removed, which is fine
		{
			let arr = sdStatusEffect.entity_to_status_effects.get( this.for );
			
			arr.splice( arr.indexOf( this ), 1 );
			arr.inversed.splice( arr.inversed.indexOf( this ), 1 );
		}
	}
	
	CameraDistanceScale3D( layer ) // so far layer is only FG (1), usually only used by chat messages
	{ return 0.95; }
	
	onThink( GSPEED ) // Class-specific, if needed
	{
		let isforless = false;
		
		if ( this._for_confirmed )
		{
			if ( !this.for || this.for._is_being_removed )
			{
				this.for = null;
				isforless = true;
			}
		}
		else
		if ( this.for )
		{
			let arr = sdStatusEffect.entity_to_status_effects.get( this.for );

			this._for_confirmed = true;

			if ( arr )
			{
				arr.push( this );
				arr.inversed.unshift( this );
			}
			else
			{
				arr = [ this ];
				arr.inversed = [ this ];
				sdStatusEffect.entity_to_status_effects.set( this.for, arr );
			}
		}
		else
		{
			isforless = true;
		}

		if ( isforless )
		{
			if ( this.remove_if_for_removed )
			{
				this.remove();
				return true;
			}
		}
		else
		{
			this.x = this.for.x + ( this.for._hitbox_x1 + this.for._hitbox_x2 ) / 2;
			this.y = this.for.y + ( this.for._hitbox_x2 + this.for._hitbox_x2 ) / 2;
		}
		
		let status_type = sdStatusEffect.types[ this.type ];
		
		if ( status_type )
		{
			if ( status_type.onThink )
			if ( status_type.onThink( this, GSPEED ) )
			{
				this.remove();
				return true;
			}
		}
		return false;
	}
	
	/*Draw( ctx, attached )
	{
		ctx.fillStyle = '#00ff00';
		ctx.fillRect( -50, -50, 100, 100 );
	}*/
	
	DrawFG( ctx, attached )
	{
		let status_type = sdStatusEffect.types[ this.type ];
		
		if ( status_type )
		if ( status_type.DrawFG )
		status_type.DrawFG( this, ctx, attached );
	}
}
export default sdStatusEffect;
