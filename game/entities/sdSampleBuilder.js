
/* global sdShop, FakeCanvasContext */

/*

	TODO: Add cable-connected workbench level inheritance

	TODO: Inherit owner's build level as long as owner is alive


*/

import sdWorld from '../sdWorld.js';
import sdSound from '../sdSound.js';
import sdEntity from './sdEntity.js';
import sdEffect from './sdEffect.js';
import sdCom from './sdCom.js';
import sdCable from './sdCable.js';
import sdBaseShieldingUnit from './sdBaseShieldingUnit.js';
import sdCharacter from './sdCharacter.js';
import sdStorage from './sdStorage.js';
import sdGun from './sdGun.js';
import sdWeaponBench from './sdWeaponBench.js';


import sdRenderer from '../client/sdRenderer.js';


class sdSampleBuilder extends sdEntity
{
	static init_class()
	{
		sdSampleBuilder.img_sample_builder = sdWorld.CreateImageFromFile( 'sdSampleBuilder' );
		
		sdSampleBuilder.TYPE_SAMPLER = 0;
		sdSampleBuilder.TYPE_BUILDER = 1;

		sdWorld.entity_classes[ this.name ] = this; // Register for object spawn
	}
	get hitbox_x1() { return -16; }
	get hitbox_x2() { return 16; }
	get hitbox_y1() { return -16; }
	get hitbox_y2() { return 16; }
	
	PrecieseHitDetection( x, y, bullet=null ) // Teleports use this to prevent bullets from hitting them like they do. Only ever used by bullets, as a second rule after box-like hit detection. It can make hitting entities past outer bounding box very inaccurate
	{
		return ( Math.abs( this.x - x ) > 5 && Math.abs( this.y - y ) > 5 );
	}
	
	DrawIn3D()
	{ return FakeCanvasContext.DRAW_IN_3D_BOX; }
	
	ObjectOffset3D( layer ) // -1 for BG, 0 for normal, 1 for FG
	{ 
		if ( layer === 0 )
		return [ 0.01, 0.01, -0.01 ];
	}
	
	get hard_collision()
	{ return false; }
	
	get is_static() // Static world objects like walls, creation and destruction events are handled manually. Do this._update_version++ to update these
	{ return true; }
	
	Damage( dmg, initiator=null )
	{
		if ( !sdWorld.is_server )
		return;
	
		dmg = Math.abs( dmg );
		
		if ( this._hea > 0 )
		{
			if ( dmg = sdBaseShieldingUnit.TestIfDamageShouldPass( this, dmg, initiator ) )
			{
				this._hea -= dmg;

				this.SetHiberState( sdEntity.HIBERSTATE_ACTIVE );

				this.SetDelay( 90 );

				this._regen_timeout = 60;

				if ( this._hea <= 0 )
				this.remove();
			}
		}
	}
	SetDelay( v )
	{
		if ( v < 0 )
		v = 0;
	
		if ( ( v > 0 ) !== ( this.delay > 0 ) )
		{
			if ( v === 0 )
			if ( this.type === sdSampleBuilder.TYPE_BUILDER )
			sdSound.PlaySound({ name:'teleport_ready', x:this.x, y:this.y, volume:1, pitch: 1.5 });
			
			this._update_version++;
		}
		this.delay = v;
	}
	constructor( params )
	{
		super( params );
		
		this.type = params.type || 0;
		
		this._hmax = 600;
		this._hea = this._hmax;
		this._regen_timeout = 0;
		
		this._shielded = null; // Is this entity protected by a base defense unit?
		
		this.toggle_enabled = false;
		
		this._sample_entity = null;
		this._sample_shop_item = null;
		
		this._old_sample_entity_net_ids = [];
		
		this._owner = null; // Will be used as builder
		
		this._build_tool_level = 0;
		this._workbench_level = 0;
		
		this.error_text = '';
		
		this.last_cost = 1;
		
		this.matter = 0;
		this.matter_max = ( this.type === sdSampleBuilder.TYPE_BUILDER ) ? 500 : 0;
		
		this.delay = 0;
		//this._update_version++
	}
	ExtraSerialzableFieldTest( prop )
	{
		return ( prop === '_old_sample_entity_net_ids' || prop === '_owner' );
	}
	MeasureMatterCost()
	{
		return this._hmax * sdWorld.damage_to_matter + 800;
	}
	onThink( GSPEED ) // Class-specific, if needed
	{
		let can_hibernateA = false;
		let can_hibernateB = !this.toggle_enabled;
		
		if ( this._regen_timeout > 0 )
		this._regen_timeout -= GSPEED;
		else
		{
			if ( this._hea < this._hmax )
			this._hea = Math.min( this._hea + GSPEED, this._hmax );
			else
			can_hibernateA = true;
		}
		
		if ( this._owner )
		{
			if ( this._owner._is_being_removed || this.type === sdSampleBuilder.TYPE_SAMPLER )
			this._owner = null;
			else
			{
				if ( this._build_tool_level !== this._owner.build_tool_level )
				this._update_version++;
				else
				if ( this.matter_max !== this._owner.matter_max )
				this._update_version++;
				
				this._build_tool_level = Math.max( this._build_tool_level, this._owner.build_tool_level );
				this.matter_max = Math.max( this.matter_max, this._owner.matter_max );
				
			}
		}

		this.SetDelay( this.delay - GSPEED );
		
		if ( sdWorld.is_server )
		if ( this.toggle_enabled )
		if ( this.type === sdSampleBuilder.TYPE_BUILDER )
		if ( this.delay <= 0 )
		{
			let s = this.GetComWiredCache( ( s )=>
			{
				return (
					( s.is( sdSampleBuilder ) && s.type === sdSampleBuilder.TYPE_SAMPLER && s.UpdateTarget() )
					||
					( s.is( sdStorage ) && s._stored_items.length > 0 )
				);
			});
			
			if ( s )
			{
				if ( s.is( sdStorage ) )
				{
					s.ActivateTrap();
					
					let ent = s.ExtractItem( 0, null, true, this.x, this.y );

					if ( ent )
					{
						sdSound.PlaySound({ name:'teleport', x:this.x, y:this.y, volume:0.25, pitch:1.5 });
						sdWorld.SendEffect({ x:this.x, y:this.y, type:sdEffect.TYPE_TELEPORT });
						
						this.SetDelay( 60 );
						this.error_text = '';
						this._update_version++;
					}
					else
					{
						this.SetDelay( 90 );
						this.error_text = 'Unable to extract item';
						this._update_version++;
					}
				}
				else
				{
					let workbenches = this.FindObjectsInACableNetwork( null, sdWorld.entity_classes.sdWorkbench );
					
					for ( let i = 0; i < workbenches.length; i++ )
					{
						this._workbench_level = Math.max( this._workbench_level, workbenches[ i ].level );
					}
					
					if ( s._sample_entity )
					if ( !s._sample_entity._is_being_removed )
					if ( s._sample_entity.is( sdGun ) )
					s._sample_entity.ttl = Math.max( s._sample_entity.ttl, sdGun.disowned_guns_ttl );
		
					let ent = sdCharacter.GeneralCreateBuildObject( this.x, this.y, s._sample_shop_item, null, this._build_tool_level, this._workbench_level, true, false, false );

					if ( ent )
					{								
						let cost = ( typeof s._sample_shop_item.matter_cost !== 'undefined' ) ? s._sample_shop_item.matter_cost : ent.MeasureMatterCost();
						this.last_cost = cost;
						this._update_version++;
						
						if ( this.matter < cost || isNaN( cost ) )
						{
							this.SetDelay( 90 );
							
							if ( cost === Infinity )
							this.error_text = 'Star Defenders can not build this item';
							else
							this.error_text = 'Not enough matter to build ( '+Math.ceil(cost)+' matter required )';
						
							this._update_version++;

							// Done at sdGun too
							ent.SetMethod( 'onRemove', ent.onRemoveAsFakeEntity ); // Disable any removal logic
							ent.remove();
							ent._remove();
							
						}
						else
						{
							this.SetDelay( 60 );
							
							sdSound.PlaySound({ name:'teleport', x:this.x, y:this.y, volume:0.25, pitch:1.5 });
							sdWorld.SendEffect({ x:this.x, y:this.y, type:sdEffect.TYPE_TELEPORT });

							this.matter -= cost;
							this.error_text = '';
							this._update_version++;

							sdCharacter.ApplyPostBuiltProperties( ent, s._sample_shop_item, this._owner );
						}
					}
					else
					{
						if ( s._sample_shop_item === null )
						this.error_text = 'Star Defenders can not build this item';
						else
						this.error_text = sdCharacter.last_build_deny_reason;
					
						this.SetDelay( 90 );
						this._update_version++;
					}
				}
			}
			else
			{
				if ( this.error_text !== 'No items to build or extract' )
				{
					this.error_text = 'No items to build or extract';
					this._update_version++;
				}
			}
		}
	
		if ( can_hibernateA && can_hibernateB )
		{
			this.SetHiberState( sdEntity.HIBERSTATE_HIBERNATED );
		}
	}
	get title()
	{
		if ( this.type === sdSampleBuilder.TYPE_SAMPLER )
		return 'Sample area for sample builder';
		
		if ( this.type === sdSampleBuilder.TYPE_BUILDER )
		return 'Sample builder';
	}
	get description()
	{
		return `Connect sample area to sample builder and use connected button or switch to start building. Requires matter to build. Sample builder can alternatively extract items from cable-connected storages (starting with oldest).`;
	}
	
	Draw( ctx, attached )
	{
		let yy = 0;
		
		if ( this.type === sdSampleBuilder.TYPE_SAMPLER )
		{
			yy = 2;
			ctx.apply_shading = false;
		}
		
		if ( this.type === sdSampleBuilder.TYPE_BUILDER )
		{
			if ( ( this.delay === 0 && this.matter >= this.last_cost ) || sdShop.isDrawing )
			{
				yy = 0;
				ctx.apply_shading = false;
			}
			else
			{
				yy = 1;
				
				if ( this.matter >= this.last_cost )
				{
				}
				else
				if ( sdWorld.time % 4000 < 2000 )
				{
					yy = 3;
				}
			}
		}

		ctx.drawImageFilterCache( sdSampleBuilder.img_sample_builder, 0, yy * 32, 32, 32, - 16, - 16, 32,32 );
	}
	DrawHUD( ctx, attached ) // foreground layer
	{
		if ( this.matter_max > 0 )
		sdEntity.TooltipUntranslated( ctx, T( this.title ) + " ( " + sdWorld.RoundedThousandsSpaces(this.matter) + " / " + sdWorld.RoundedThousandsSpaces(this.matter_max) + " )", 0, -8 );
		else
		sdEntity.TooltipUntranslated( ctx, T( this.title ), 0, -8 );
		//this.DrawConnections( ctx );
		
		sdEntity.TooltipUntranslated( ctx, this.error_text, 0, 0, '#ffff00' );
	}
	
	UpdateTarget( from_entity=null ) // from_entity is a new target to add. Returns true if there is target
	{
		if ( sdWorld.is_server )
		{
			for ( let i = 0; i < this._old_sample_entity_net_ids.length; i++ )
			{
				let e = sdEntity.entities_by_net_id_cache_map.get( this._old_sample_entity_net_ids[ i ] );

				if ( !e || e._is_being_removed || !this.DoesOverlapWith( e ) )
				{
					this._old_sample_entity_net_ids.splice( i, 1 );
					i--;
					continue;
				}
			}

			if ( from_entity )
			{
				let id = this._old_sample_entity_net_ids.indexOf( from_entity._net_id );
				if ( id === -1 )
				this._old_sample_entity_net_ids.push( from_entity._net_id );
			}

			if ( this._old_sample_entity_net_ids.length > 0 )
			{
				from_entity = sdEntity.entities_by_net_id_cache_map.get( this._old_sample_entity_net_ids[ 0 ] );

				if ( this._sample_entity !== from_entity )
				{
					let _class = from_entity.GetClass();

					let best_shop_item = null;
					let best_value = -100;
					
					// Make guns require at least one property requirement met
					if ( from_entity.is( sdGun ) )
					best_value = 0;

					let props_to_compare = [ 'type', 'kind', 'variation', 'multiplier', 'width', 'height', 'matter_max', 'anti_base_mode', 'filter', 'texture_id', 'w', 'h', 'class', 'extra' ];

					for ( let i = 0; i < sdShop.options.length; i++ )
					{
						let option = sdShop.options[ i ];

						if ( option._class === _class )
						if ( option._category !== 'Development tests' )
						{
							let value = 0;
							for ( let i2 = 0; i2 < props_to_compare.length; i2++ )
							{
								let prop = props_to_compare[ i2 ];

								let ent_value = from_entity[ prop ] || from_entity[ '_' + prop ] || undefined;

								if ( ent_value !== undefined )
								{
									//if ( option[ prop ] !== undefined )
									//value += 1;

									if ( option[ prop ] === ent_value )
									value += 1;
								}
							}

							if ( value > best_value )
							{
								best_shop_item = option;
								best_value = value;
							}
						}
					}

					this._sample_entity = from_entity;
					this._sample_shop_item = best_shop_item;
				}
				return true;
			}
		}
		
		return false;
	}

	onMovementInRange( from_entity )
	{
		if ( !sdWorld.is_server || this.type !== sdSampleBuilder.TYPE_SAMPLER || from_entity.IsBGEntity() !== 0 )
		return;
			
		if ( !from_entity.is( sdWeaponBench ) ) // Alternatively use these as gun holders if players are worried gun will disappear
		this.UpdateTarget( from_entity );
	}
	onRemove() // Class-specific, if needed
	{
		if ( !sdWorld.is_server )
		if ( this._net_id !== undefined ) // Was ever synced rather than just temporarily object for shop
		if ( this._broken )
		{
			sdSound.PlaySound({ name:'blockB4', 
				x:this.x + 32 / 2, 
				y:this.y + 32 / 2, 
				volume:( 32 / 32 ) * ( 16 / 32 ), 
				pitch: ( this.material === sdSampleBuilder.MATERIAL_WALL ) ? 1 : 1.5,
				_server_allowed:true });
			
			let x,y,a,s;
			let step_size = 4;
			for ( x = step_size / 2; x < 32; x += step_size )
			for ( y = step_size / 2; y < 32; y += step_size )
			if ( Math.abs( 16 - x ) > 7 && Math.abs( 16 - y ) > 7 )
			{
				a = Math.random() * 2 * Math.PI;
				s = Math.random() * 4;
				let ent = new sdEffect({ x: this.x + x - 16, y: this.y + y - 16, type:sdEffect.TYPE_ROCK, sx: Math.sin(a)*s, sy: Math.cos(a)*s });
				sdEntity.entities.push( ent );
			}
		}
	}
}
//sdSampleBuilder.init_class();

export default sdSampleBuilder;