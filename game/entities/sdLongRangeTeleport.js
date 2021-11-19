
import sdWorld from '../sdWorld.js';
import sdSound from '../sdSound.js';
import sdEntity from './sdEntity.js';
import sdEffect from './sdEffect.js';
import sdCom from './sdCom.js';
import sdArea from './sdArea.js';
import sdCommandCentre from './sdCommandCentre.js';
import sdCrystal from './sdCrystal.js';

//import sdServerToServerProtocol from '../server/sdServerToServerProtocol.js';

import sdRenderer from '../client/sdRenderer.js';


class sdLongRangeTeleport extends sdEntity
{
	static init_class()
	{
		sdLongRangeTeleport.img_long_range_teleport = sdWorld.CreateImageFromFile( 'long_range_teleport' );
		
		sdLongRangeTeleport.max_matter = 300;
		
		sdLongRangeTeleport.long_range_teleports = [];
		
		//sdLongRangeTeleport.delay_simple = 30 * 10; // 10 seconds
		sdLongRangeTeleport.delay_simple = 30 * 3; // 3 seconds
		
		//sdLongRangeTeleport.redirect_codes = {}; // { code: _net_id }
		sdLongRangeTeleport.one_time_keys = []; // for redirections
		
		sdWorld.entity_classes[ this.name ] = this; // Register for object spawn
	}
	get hitbox_x1() { return -48; }
	get hitbox_x2() { return 48; }
	get hitbox_y1() { return -11; }
	get hitbox_y2() { return 0; }
	
	get spawn_align_x(){ return 8; };
	get spawn_align_y(){ return 8; };
	
	get hard_collision()
	{ return true; }
	
	get is_static() // Static world objects like walls, creation and destruction events are handled manually. Do this._update_version++ to update these
	{ return true; }
	
	Damage( dmg, initiator=null )
	{
		if ( !sdWorld.is_server )
		return;
	
		dmg = Math.abs( dmg );
		
		if ( this.hea > 0 )
		{
			if ( !this.is_server_teleport )
			this.hea -= dmg;
			
			this.SetHiberState( sdEntity.HIBERSTATE_ACTIVE );
			
			if ( this.delay < 90 )
			this.SetDelay( 90 );
			
			this._regen_timeout = 60;

			if ( this.hea <= 0 )
			this.remove();
		}
	}
	Activation()
	{
		this.is_charging = 1;
		this.charge_timer = 0;
		this.SetHiberState( sdEntity.HIBERSTATE_ACTIVE );
		this._update_version++;
		sdSound.PlaySound({ name:'crystal_combiner_start', x:this.x, y:this.y, volume:3, pitch:0.5 });
	}
	Deactivation()
	{
		this.is_charging = 0;
		this._update_version++;
		sdSound.PlaySound({ name:'crystal_combiner_end', x:this.x, y:this.y, volume:3, pitch:0.5 });

	}
	SetDelay( v )
	{
		if ( v < 0 )
		v = 0;

		if ( ( v > 0 ) !== ( this.delay > 0 ) )
		{
			if ( v === 0 )
			sdSound.PlaySound({ name:'teleport_ready', x:this.x, y:this.y, volume:1 });
		}
		
		if ( Math.ceil( v / 30 ) !== Math.ceil( this.delay / 30 ) )
		{
			this._update_version++;
		}
		
		this.delay = v;

		if ( v > 0 )
		this.SetHiberState( sdEntity.HIBERSTATE_ACTIVE );
	}
	onMatterChanged( by=null ) // Something like sdLongRangeTeleport will leave hiberstate if this happens
	{
		this.SetHiberState( sdEntity.HIBERSTATE_ACTIVE );
	}
	constructor( params )
	{
		super( params );
		
		this.hmax = 1500;
		this.hea = this.hmax;
		this._regen_timeout = 0;
		
		this.delay = sdLongRangeTeleport.delay_simple;
		//this._update_version++
		
		this._matter_max = sdLongRangeTeleport.max_matter;
		this.matter = 0;
		
		// When initiation started and access granted - it will start increasing these
		this.charge_timer = 0; // 0..100 percents
		this.is_charging = 0; // This one will be 1 when preparing to swap entities
		
		this._charge_complete_method = null;
		
		this.is_server_teleport = params.is_server_teleport || 0; // 1 if admin creates it, 0 if user (in that case it works as a task completion target). Requires matter in both cases probably
		this.remote_server_url = 'http://localhost:3000';
		this.remote_server_target_net_id = this._net_id + '';
		
		this.is_busy_since = 0; // Used to prevent activations whenever data is being sent/received
		
		//this.owner_net_id = this._owner ? this._owner._net_id : null;
		
		sdLongRangeTeleport.long_range_teleports.push( this );
	}
	/*ExtraSerialzableFieldTest( prop )
	{
		if ( prop === '_owner' ) return true;
		
		return false;
	}*/
	
	MeasureMatterCost()
	{
		return this.is_server_teleport ? Infinity : ( this.hmax * sdWorld.damage_to_matter + 100 );
	}
	onThink( GSPEED ) // Class-specific, if needed
	{
		if ( !sdWorld.is_server )
		return;
	
		let can_hibernateA = false;
		let can_hibernateB = false;
		
		if ( this._regen_timeout > 0 )
		this._regen_timeout -= GSPEED;
		else
		{
			if ( this.hea < this.hmax )
			this.hea = Math.min( this.hea + GSPEED, this.hmax );
			else
			can_hibernateA = true;
		}
		
		if ( this.matter >= this._matter_max )
		{
			if ( this.delay > 0 )
			this.SetDelay( this.delay - GSPEED );
			else
			can_hibernateB = true;
		}
		else
		can_hibernateB = true;
	
		if ( this.is_charging )
		{
			this.charge_timer = Math.min( 100, this.charge_timer + GSPEED * 0.66 );
			if ( this.charge_timer >= 100 )
			{
				if ( this._charge_complete_method )
				{
					this._charge_complete_method();
					this._charge_complete_method = null;
				}
			}
			this._update_version++;
		}
		else
		{
			if ( this.charge_timer > 0 )
			{
				this.charge_timer = Math.max( 0, this.charge_timer - GSPEED * 5 );
				this._update_version++;
			}
		}
	
		if ( can_hibernateA && can_hibernateB && this.charge_timer === 0 )
		{
			this.SetHiberState( sdEntity.HIBERSTATE_HIBERNATED );
		}
	}
	get title()
	{
		let postfix = this.is_server_teleport ? '' : "  ( " + ~~(this.matter) + " / " + ~~(this._matter_max) + " )";
		
		return 'Long-range teleport' + postfix;

	}
	
	IsEarlyThreat() // Used during entity build & placement logic - basically turrets, barrels, bombs should have IsEarlyThreat as true or else players would be able to spawn turrets through closed doors & walls. Coms considered as threat as well because their spawn can cause damage to other players
	{ return true; }
	
	Draw( ctx, attached )
	{
		//if ( this.matter >= this._matter_max || sdShop.isDrawing )
		{
			if ( this.delay === 0 || sdShop.isDrawing )
			{
			}
			
			let version_offset = 0;
			
			if ( this.is_server_teleport )
			{
				version_offset = 0;
			}
			else
			{
				let cc_near = this.GetComWiredCache( null, sdCommandCentre );
				
				if ( cc_near && this.matter >= this._matter_max )
				{
					if ( this.delay <= 0 )
					version_offset = 32;
					else
					version_offset = 64;
				}
				else
				{
					version_offset = ( sdWorld.time % 4000 < 2000 ? 96 : 128 );
				}
			}

		    if ( this.charge_timer > 0 )
		    {
			    ctx.filter = 'brightness('+ ( 1 +(~~(this.charge_timer)) / 100 ) + ')';
			    ctx.drawImageFilterCache( sdLongRangeTeleport.img_long_range_teleport, 0,version_offset,96,32, -48,-16,96,32 );
			    ctx.filter = 'none';
		    }
		    else
			ctx.drawImageFilterCache( sdLongRangeTeleport.img_long_range_teleport, 0,version_offset,96,32, -48,-16,96,32 );
		}
		/*else
		{
			ctx.drawImageFilterCache( sdLongRangeTeleport.img_long_range_teleport_no_matter, ( sdWorld.time % 4000 < 2000 ? 1 : 0 )*32,0,32,32, - 16, - 16, 32,32 );
		}*/
		
		if ( this.is_charging )
		{
			let w = 48 * 2;
			
			ctx.fillStyle = '#000000';
			ctx.fillRect( 0 - w / 2, 0 - 70, w, 3 );
			
			ctx.fillStyle = '#aabbff';
			ctx.fillRect( 1 - w / 2, 1 - 70, ( w - 2 ) * Math.max( 0, this.charge_timer / 100 ), 1 );
		}
	}
	DrawHUD( ctx, attached ) // foreground layer
	{
		sdEntity.Tooltip( ctx, this.title, 0, -48 );
	}
	
	onRemove() // Class-specific, if needed
	{
		this.onRemoveAsFakeEntity();
	}
	onRemoveAsFakeEntity()
	{
		let i = sdLongRangeTeleport.long_range_teleports.indexOf( this );
		if ( i !== -1 )
		sdLongRangeTeleport.long_range_teleports.splice( i, 1 );
	
		if ( !sdWorld.is_server )
		if ( this._net_id !== undefined ) // Was ever synced rather than just temporarily object for shop
		if ( this._broken )
		{
			sdWorld.BasicEntityBreakEffect( this, 3 );
				
			/*
			sdSound.PlaySound({ name:'block4', 
				x:this.x + 32 / 2, 
				y:this.y + 32 / 2, 
				volume:( 32 / 32 ) * ( 16 / 32 ), 
				pitch: ( this.material === sdLongRangeTeleport.MATERIAL_WALL ) ? 1 : 1.5,
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
			}*/
		}
	}
	
	//GetEntitiesOnTop( partial_colision_too=false )
	GetEntitiesOnTop( use_task_filter=false )
	{
		let x1 = this.x - 48;
		let x2 = this.x + 48;
		let y1 = this.y - 64;
		let y2 = this.y + this.hitbox_y1;
		
		let ents = sdWorld.GetAnythingNear( (x1+x2)/2, (y1+y2)/2, Math.sqrt( Math.pow(x1-x2,2) + Math.pow(y1-y2,2) ) / 2 );
		
		let ents_final = [];
		
		let IsTeleportable = ( ent )=>
		{
			if ( use_task_filter )
			{
				if ( ent.is( sdCrystal ) )
				if ( ent.type === sdCrystal.TYPE_CRYSTAL_CRAB )
				return true;
		
				return false;
			}
			else
			{

				if ( ent.IsPlayerClass() && !ent._socket && ent._ai_enabled <= 0 )
				{
					// Do not teleport disconnected players
					return false;
				}
				else
				if ( ent.is_static || ent.IsBGEntity() !== 0 || ent._is_being_removed || ( ent.hea || ent._hea ) === undefined )
				{
					return false;
				}

				if ( ent._held_by || ent.held_by )
				{
					return IsTeleportable( ent._held_by || ent.held_by );
				}
			}
			
			return true;
		};
		
		for ( let i = 0; i < ents.length; i++ )
		{
			let ent = ents[ i ];
			
			if ( IsTeleportable( ent ) )
			{
				//if ( partial_colision_too )
				//{
					//if ( ent.hard_collision ) // Do not count non-hard collision entities when trying to teleport on top of them
					if ( ent.x + ent.hitbox_x1 <= x2 )
					if ( ent.x + ent.hitbox_x2 >= x1 )
					if ( ent.y + ent.hitbox_y1 <= y2 )
					if ( ent.y + ent.hitbox_y2 >= y1 )
					ents_final.push( ent );
				/*}
				else
				{
					if ( ent.x + ent.hitbox_x1 >= x1 )
					if ( ent.x + ent.hitbox_x2 <= x2 )
					if ( ent.y + ent.hitbox_y1 >= y1 )
					if ( ent.y + ent.hitbox_y2 <= y2 )
					ents_final.push( ent );
				}
				*/
			}
		}
		return ents_final;
	}

	ExtractEntitiesOnTop( collected_entities_array=null, use_task_filter=false )
	{
		let ents_to_push = this.GetEntitiesOnTop( use_task_filter );
		let snapshots = [];
		let current_frame = globalThis.GetFrame();

		for ( let i = 0; i < ents_to_push.length; i++ )
		snapshots.push( ents_to_push[ i ].GetSnapshot( current_frame, true ) );
	
		if ( ents_to_push.length > 0 )
		sdSound.PlaySound({ name:'teleport', x:this.x, y:this.y, volume:0.5 });

		for ( let i = 0; i < ents_to_push.length; i++ )
		{
			let e = ents_to_push[ i ];
			
			sdWorld.SendEffect({ x:e.x + (e.hitbox_x1+e.hitbox_x2)/2, y:e.y + (e.hitbox_y1+e.hitbox_y2)/2, type:sdEffect.TYPE_TELEPORT });
			
			e.remove();
			e._broken = false;
			
			if ( collected_entities_array )
			collected_entities_array.push( e );
		}

		return snapshots;
	}
	
	InsertEntitiesOnTop( snapshots, relative_x, relative_y )
	{
		let one_time_keys = [];
		
		let net_id_remap = new Map();
		
		sdWorld.unresolved_entity_pointers = [];
	
		if ( snapshots.length > 0 )
		sdSound.PlaySound({ name:'teleport', x:this.x, y:this.y, volume:0.5 });
						
		for ( let i = 0; i < snapshots.length; i++ )
		{
			let snapshot = snapshots[ i ];
			
			net_id_remap.set( snapshot._net_id, sdEntity.entity_net_ids );
			snapshot._net_id = sdEntity.entity_net_ids++;
			
			snapshot.x = snapshot.x - relative_x + this.x;
			snapshot.y = snapshot.y - relative_y + this.y;
			
			let ent = sdEntity.GetObjectFromSnapshot( snapshot );
			
			if ( ent )
			if ( !ent._is_being_removed )
			{
				if ( ent._affected_hash_arrays.length > 0 ) // Easier than checking for hiberstates
				sdWorld.UpdateHashPosition( ent, false, false );
			
				sdWorld.SendEffect({ x:ent.x + (ent.hitbox_x1+ent.hitbox_x2)/2, y:ent.y + (ent.hitbox_y1+ent.hitbox_y2)/2, type:sdEffect.TYPE_TELEPORT });
			}
			
			let key = {
				hash: Math.random()+''+Math.random()+''+Math.random()+''+Math.random(),
				ent: ent,
				until: sdWorld.time + 30 * 1000
			};
			
			sdLongRangeTeleport.one_time_keys.push( key );
			
			one_time_keys[ i ] = key.hash;
		}
		for ( let i = 0; i < sdWorld.unresolved_entity_pointers.length; i++ )
		{
			if ( net_id_remap.has( sdWorld.unresolved_entity_pointers[ i ][ 3 ] ) )
			sdWorld.unresolved_entity_pointers[ i ][ 3 ] = net_id_remap.get( sdWorld.unresolved_entity_pointers[ i ][ 3 ] );
			else
			{
				trace( 'Warning: Pointer is impossible to resolve - entity was not recreated in new world. Pointer will likely be set to null. Pointer: ', sdWorld.unresolved_entity_pointers[ i ] );
				sdWorld.unresolved_entity_pointers[ i ][ 3 ] = -1;
			}
		}
		//sdWorld.unresolved_entity_pointers.push([ this, prop, snapshot[ prop ]._class, snapshot[ prop ]._net_id ]);
		
		
		sdWorld.SolveUnresolvedEntityPointers();
		sdWorld.unresolved_entity_pointers = null;
		
		return one_time_keys;
	}
	
	static AuthorizedIncomingS2SProtocolMessageHandler( data_object, callback ) // From legit/trusted source
	{
		let ret = null;
			
		if ( data_object.action === 'Exchange new _net_ids' )
		{
			/*ret = {
				message: 'New _net_ids are as follows'
			};*/
			debugger;
		}
		else
		{

			let possible_ent = sdEntity.entities_by_net_id_cache_map.get( parseInt( data_object.target_net_id ) );

			if ( possible_ent )
			{
				if ( data_object.action === 'Require long-range teleportation' )
				{
					ret = {
						message: 'Granted'
					};
					possible_ent.Activation();
				}
				else
				if ( data_object.action === 'Do long-range teleportation' )
				{
					possible_ent.Deactivation();
					
					let one_time_keys = possible_ent.InsertEntitiesOnTop( data_object.snapshots, data_object.relative_x, data_object.relative_y );

					ret = {
						message: 'Take these',
						snapshots: possible_ent.ExtractEntitiesOnTop(),
						relative_x: possible_ent.x,
						relative_y: possible_ent.y,
						one_time_keys: one_time_keys
					};
				}
			}
			else
			ret = {
				message: 'Bad target'
			};
		}
		
		callback( ret );
	}
	
	ExecuteContextCommand( command_name, parameters_array, exectuter_character, executer_socket ) // New way of right click execution. command_name and parameters_array can be anything! Pay attention to typeof checks to avoid cheating & hacking here. Check if current entity still exists as well (this._is_being_removed). exectuter_character can be null, socket can't be null
	{
		if ( !this._is_being_removed )
		if ( this.hea > 0 )
		if ( exectuter_character )
		if ( exectuter_character.hea > 0 )
		{
			if ( exectuter_character._god || sdWorld.inDist2D_Boolean( this.x, this.y, exectuter_character.x, exectuter_character.y, 64 ) )
			{
				if ( command_name === 'TELEPORT_STUFF' )
				{
					if ( !this.is_server_teleport )
					{
						let cc_near = this.GetComWiredCache( null, sdCommandCentre );
						if ( cc_near )
						{
							if ( this.matter >= this._matter_max )
							{
								if ( this.delay === 0 )
								{
									this.Activation();
									
									this._charge_complete_method = ()=>
									{
										this.Deactivation();
										
										let collected_entities_array = [];
										
										this.ExtractEntitiesOnTop( collected_entities_array, true );
										
										if ( collected_entities_array.length === 0 )
										executer_socket.SDServiceMessage( 'Tasks are not ready yet... But you can find some crab crystals for the mothership!' );
										else
										exectuter_character._score += collected_entities_array.length * 20;
									};
								}
								else
								executer_socket.SDServiceMessage( 'Not activated yet - possibly due to damage' );
							}
							else
							executer_socket.SDServiceMessage( 'Not enough matter' );
						}
						else
						executer_socket.SDServiceMessage( 'Long-range teleport requires Command Centre connected' );
					}
					else
					{
						if ( sdWorld.time < this.is_busy_since + 60 * 1000 )
						{
							executer_socket.SDServiceMessage( 'Busy - previous sequence is not finished yet' );
							return;
						}
						else
						{
							executer_socket.SDServiceMessage( 'Pending remote connection...' );

							this.SetDelay( sdLongRangeTeleport.delay_simple );
							this.SetHiberState( sdEntity.HIBERSTATE_ACTIVE );

							sdServerToServerProtocol.SendData(
								this.remote_server_url,
								{
									action: 'Require long-range teleportation',
									target_net_id: this.remote_server_target_net_id
								},
								( response=null )=>
								{
									this.is_busy_since = 0;

									if ( response )
									{
										executer_socket.SDServiceMessage( '' );
							
										if ( response.message === 'Granted' )
										{
											//sdSound.PlaySound({ name:'teleport', x:this.x, y:this.y, volume:1 });
											this.Activation();
											
											this._charge_complete_method = ()=>
											{
												let collected_entities_array = [];

												let snapshots = this.ExtractEntitiesOnTop( collected_entities_array );

												sdServerToServerProtocol.SendData(
													this.remote_server_url,
													{
														action: 'Do long-range teleportation',
														target_net_id: this.remote_server_target_net_id,
														snapshots: snapshots,
														relative_x: this.x,
														relative_y: this.y
													},
													( response=null )=>
													{
														this.Deactivation();
														
														if ( response )
														{
															//let net_id_replacements = 
															this.InsertEntitiesOnTop( response.snapshots, response.relative_x, response.relative_y );

															/*sdServerToServerProtocol.SendData(
																this.remote_server_url,
																{
																	action: 'Exchange new _net_ids',
																	net_id_replacements: net_id_replacements
																},
																( response=null )=>
																{
																	debugger;
																}
															);*/
															for ( let i = 0; i < collected_entities_array.length; i++ )
															if ( collected_entities_array[ i ].IsPlayerClass() )
															if ( collected_entities_array[ i ]._socket )
															collected_entities_array[ i ]._socket.Redirect( this.remote_server_url, response.one_time_keys[ i ] );
														}
														else
														{
															this.InsertEntitiesOnTop( snapshots, this.x, this.y );
															debugger; // Restore _net_ids for players
														}
													}
												);
											};
										}
										else
										executer_socket.SDServiceMessage( 'Remote server responded with: ' + JSON.stringify( response ) );
									}
									else
									executer_socket.SDServiceMessage( 'Unable to reach remote server' );
								}
							);
						}
					}
				}
				else
				if ( exectuter_character._god )
				{
					if ( command_name === 'SET_REMOTE_SERVER_URL' )
					if ( parameters_array.length === 1 && typeof parameters_array[ 0 ] === 'string' && parameters_array[ 0 ].length < 300 )
					{
						this.remote_server_url = parameters_array[ 0 ];
						executer_socket.SDServiceMessage( 'Remote server URL set' );
					}
					
					if ( command_name === 'SET_REMOTE_TARGET_NET_ID' )
					if ( parameters_array.length === 1 && typeof parameters_array[ 0 ] === 'string' && parameters_array[ 0 ].length < 64 )
					{
						this.remote_server_target_net_id = parameters_array[ 0 ];
						executer_socket.SDServiceMessage( 'Remote _net_id set' );
					}
				}
				else
				executer_socket.SDServiceMessage( 'No permissions' );
			}
			else
			executer_socket.SDServiceMessage( 'Long-range teleport is too far' );
		}
	}
	PopulateContextOptions( exectuter_character ) // This method only executed on client-side and should tell game what should be sent to server + show some captions. Use sdWorld.my_entity to reference current player
	{
		if ( !this._is_being_removed )
		if ( this.hea > 0 )
		if ( exectuter_character )
		if ( exectuter_character.hea > 0 )
		if ( exectuter_character._god || sdWorld.inDist2D_Boolean( this.x, this.y, exectuter_character.x, exectuter_character.y, 64 ) )
		{
			/*if ( sdWorld.my_entity && this.owner_net_id === sdWorld.my_entity._net_id )
			this.AddContextOption( 'Lose ownership', 'UNRESCUE_HERE', [] );
			else
			this.AddContextOption( 'Set as personal rescue teleport', 'RESCUE_HERE', [] );*/
			
			if ( exectuter_character._god )
			{
				this.AddPromptContextOption( 'Set remote server URL', 'SET_REMOTE_SERVER_URL', [ undefined ], 'Enter remote server URL (same as for players)', this.remote_server_url, 300 );
				this.AddPromptContextOption( 'Set remote long-range teleport _net_id', 'SET_REMOTE_TARGET_NET_ID', [ undefined ], 'Enter remote server URL (same as for players)', this.remote_server_target_net_id, 64 );
				this.AddPromptContextOption( 'Get this long-range teleport _net_id', 'GET_REMOTE_TARGET_NET_ID', [ undefined ], 'This is a _net_id of this long-range teleport entity', this._net_id, 64 );
			}
			
			if ( !this.is_server_teleport )
			this.AddContextOption( 'Initiate teleportation (300 mater)', 'TELEPORT_STUFF', [] );
			else
			this.AddContextOption( 'Initiate teleportation', 'TELEPORT_STUFF', [] );
		}
	}
}
//sdLongRangeTeleport.init_class();

export default sdLongRangeTeleport;