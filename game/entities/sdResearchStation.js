
import sdWorld from '../sdWorld.js';
import sdSound from '../sdSound.js';
import sdEntity from './sdEntity.js';
import sdEffect from './sdEffect.js';
import sdCharacter from './sdCharacter.js';
import sdTask from './sdTask.js';
import sdGun from './sdGun.js';
import sdBaseShieldingUnit from './sdBaseShieldingUnit.js';

import sdRenderer from '../client/sdRenderer.js';
import sdShop from '../client/sdShop.js';
import sdResearchManager from '../interfaces/sdResearchManager.js';


class sdResearchStation extends sdEntity
{
	static init_class()
	{
		sdResearchStation.img_cc = sdWorld.CreateImageFromFile( 'command_centre' ); // New sprite by Flora

		sdResearchStation.DATA_CRYSTAL = 0;
		sdResearchStation.DATA_ORGANIC = 1;
		sdResearchStation.DATA_TECHNOLOGY = 2;
		sdResearchStation.DATA_WEAPON = 3;

		sdResearchStation.starting_data = [ 0, 0, 0, 0 ];
		
		sdResearchStation.all_stations = [];

		sdWorld.entity_classes[ this.name ] = this; // Register for object spawn
	}
	get hitbox_x1() { return -14; }
	get hitbox_x2() { return 14; }
	get hitbox_y1() { return -15; }
	get hitbox_y2() { return 15; }
	
	get hard_collision()
	{ return true; }
	
	get is_static() // Static world objects like walls, creation and destruction events are handled manually. Do this._update_version++ to update these
	{ return false; }
	
	Damage( dmg, initiator=null )
	{
		if ( !sdWorld.is_server )
		return;
	
		dmg = Math.abs( dmg );
		
		if ( this.hea > 0 )
		{
			if ( dmg = sdBaseShieldingUnit.TestIfDamageShouldPass( this, dmg, initiator ) )
			{
				this.SetHiberState( sdEntity.HIBERSTATE_ACTIVE );
		
				this.hea -= dmg;

				this._update_version++;

				if ( this.hea <= 0 )
				{
					this.remove();
				}
				else
				{
					this._regen_timeout = 30 * 10;
				}
			}
		}
	}
	// Moved to index.js
	/*SyncedToPlayer( character ) // Shortcut for enemies to react to players
	{
		if ( this.self_destruct_on < sdCommandCentre.time_to_live_without_matter_keepers_near - 60 ) // Update once per minute
		if ( character.matter > sdCharacter.matter_required_to_destroy_command_center )
		{
			this.self_destruct_on = sdWorld.time + sdCommandCentre.time_to_live_without_matter_keepers_near;
		}
	}*/
	constructor( params )
	{
		super( params );
		
		this.hmax = 5000;
		this.hea = this.hmax;
		this._regen_timeout = 0;
		
		this._shielded = null; // Is this entity protected by a base defense unit?

		this.research_data = [ 0, 0, 0, 0 ];

		this._has_enough_data = false;
		this._next_research_attempt = 0;

		this.unlocked_items = sdResearchStation.GetDefaultUnlockedItems();
		this.enabled_items = this.unlocked_items.slice(); // These are synced to the build tool's .extra property
		this.researching_items = [];

		this._research_index = -1;

		this.matter = 0;
		this.matter_max = 0;

		sdResearchStation.all_stations.push( this );
	}
	ExtraSerialzableFieldTest( prop )
	{
		return ( prop === '_shielded' );
	}

	static MeetsDataRequirement( data, required_data )
	{
		if ( !required_data )
		return true;

		if ( !data )
		return false;

		for ( let i = 0; i < required_data.length; i++ )
		if ( required_data[ i ] > ( data[ i ] || 0 ) )
		return false;

		return true;
	}
	static GetDefaultUnlockedItems()
	{
		//return [ 'sdResearchStation.0' ]; // Hack
		let items = [];

		for ( let i = 0; i < sdShop.options.length; i++ )
		{
			let shop_item = sdShop.options[ i ];

			if ( ( shop_item._matter_for_unlock || 0 ) <= 0 && sdResearchStation.MeetsDataRequirement( sdResearchStation.starting_data, ( shop_item._data_for_unlock || null ) ) )
			{
				let item_id = sdShop.GetItemUnlockId( shop_item );
				
				if ( item_id )
				if ( items.indexOf( item_id ) === -1 )
				items.push( item_id );
			}
		}

		return items;
	}

	IsVehicle()
	{
		return true;
	}
	IsFakeVehicleForEKeyUsage()
	{
		return true;
	}
	
	
	MeasureMatterCost()
	{
		//return 0; // Hack
		
		return this.hmax * sdWorld.damage_to_matter + 200;
	}
	onThink( GSPEED ) // Class-specific, if needed
	{
		//this._armor_protection_level = 0; // Never has protection unless full health reached
			
		let can_hibernate = false;

		if ( this._regen_timeout > 0 )
		this._regen_timeout -= GSPEED;
		else
		{
			if ( this.hea < this.hmax )
			{
				if ( sdWorld.is_server )
				{
					this.hea = Math.min( this.hea + GSPEED, this.hmax );

					//if ( sdWorld.is_server )
					//this.hea = this.hmax; // Hack

					this._update_version++;
				}
			}
			else
			can_hibernate = this.researching_items.length <= 0;
		}

		if ( this.researching_items.length > 0 )
		{
			if ( this._next_research_attempt < sdWorld.time )
			{
				this._next_research_attempt = sdWorld.time + 500;

				if ( this._research_index === -1 )
				{
					for ( let i = 0; i < this.researching_items.length; i++ )
					{
						this._research_index = sdShop.GetIndexFromUnlockId( this.researching_items[ i ] );
						
						if ( this._research_index === -1 )
						{
							//this.researching_items.shift(); // unlock id belongs to an unavailable shop item
						}
						else
						{
							break;
						}
					}
				}

				if ( this._research_index !== -1 )
				{
					if ( sdResearchStation.MeetsDataRequirement( this.research_data, ( sdShop.options[ this._research_index ]._data_for_unlock || null ) ) )
					{
						let required_matter = ( sdShop.options[ this._research_index ]._matter_for_unlock || 0 );

						if ( this.matter_max !== required_matter )
						this.matter_max = Math.max( required_matter, this.matter ); // Keep using held matter for unlocks if it exceeds the required amount?

						if ( this.matter >= this.matter_max )
						{
							this.matter -= required_matter;
							this.matter_max = this.matter;

							let item_id = this.researching_items.shift();
							this.unlocked_items.push( item_id );
							this.enabled_items.push( item_id );

							this._research_index = -1;
							this._next_research_attempt = sdWorld.time + 1000 * 2;

							//executer_socket.CommandFromEntityClass( sdResearchStation, 'UPDATE_ARRAY', [ 'unlocked_items', this.unlocked_items ] ); // class, command_name, parameters_array
							//executer_socket.CommandFromEntityClass( sdResearchStation, 'UPDATE_ARRAY', [ 'enabled_items', this.enabled_items ] ); // class, command_name, parameters_array
							// Send effect for in-world unlock notification
						}
					}
				}
			}
		}
		else
		{
			this.matter_max = this.matter;
		}

		if ( can_hibernate )
		this.SetHiberState( sdEntity.HIBERSTATE_HIBERNATED_NO_COLLISION_WAKEUP );
	}
	get title()
	{
		return 'Research Station';
	}
	get description()
	{
		return 'Allows you to unlock new items and equipment for the build tool. Right click on the research station to begin researching items and view their requirements.';// Most items need research data in addition to matter. To get this, use the Atomizer weapon on entities to collect research data on them, and then upload it to the research station.';
	}
	Draw( ctx, attached )
	{
		if ( sdShop.isDrawing )
		ctx.scale( 0.5,0.5 );
	
		ctx.drawImageFilterCache( sdResearchStation.img_cc, -32, -16 - 32, 64,64 );
	}
	DrawHUD( ctx, attached ) // foreground layer
	{
		sdEntity.Tooltip( ctx, T( this.title ) + " ( " + ~~(this.matter) + " / " + ~~(this.matter_max) + " )", 0, -8 - 6 );

		//sdEntity.TooltipUntranslated( ctx, T( this.title ), 0, -8 - 6 );

		let w = 40;
	
		ctx.fillStyle = '#000000';
		ctx.fillRect( 0 - w / 2, 0 - 26, w, 3 );

		ctx.fillStyle = '#FF0000';
		ctx.fillRect( 1 - w / 2, 1 - 26, ( w - 2 ) * Math.max( 0, this.hea / this.hmax ), 1 );
	}
	
	onRemove() // Class-specific, if needed
	{
		if ( this._broken )
		{
			sdWorld.BasicEntityBreakEffect( this, 10 );
		}
		
		this.onRemoveAsFakeEntity();
	}
	onRemoveAsFakeEntity()
	{
		let id = sdResearchStation.all_stations.indexOf( this );
		if ( id !== -1 )
		sdResearchStation.all_stations.splice( id, 1 );
	}
	
	
	static ReceivedCommandFromEntityClass( command_name, parameters_array )
	{
		sdResearchManager.HandleServerCommand( command_name, parameters_array );
	}
	
	ExecuteContextCommand( command_name, parameters_array, executer_character, executer_socket ) // New way of right click execution. command_name and parameters_array can be anything! Pay attention to typeof checks to avoid cheating & hacking here. Check if current entity still exists as well (this._is_being_removed). executer_character can be null, socket can't be null
	{
		if ( !this._is_being_removed )
		if ( this.hea > 0 )
		if ( executer_character )
		if ( executer_character.hea > 0 )
		if ( this.inRealDist2DToEntity_Boolean( executer_character, 32 ) )
		{
			if ( command_name === 'OPEN_MENU' )
			{
				
			}
			else
			if ( command_name === 'TOGGLE_ITEM' )
			{
				let shop_index = parameters_array[ 0 ];
				let unlock_id = sdShop.GetItemUnlockId( sdShop.options[ shop_index ] );

				if ( unlock_id ) // Make sure it's an unlockable shop item
				{
					if ( this.unlocked_items.indexOf( unlock_id ) === -1 )
					{
						let id = this.researching_items.indexOf( unlock_id );

						if ( id === -1 )
						{
							this.researching_items.push( unlock_id );
							this.SetHiberState( sdEntity.HIBERSTATE_ACTIVE );
						}
						else
						this.researching_items.splice( id, 1 );


						//executer_socket.CommandFromEntityClass( sdResearchStation, 'UPDATE_ARRAY', [ 'researching_items', this.researching_items ] ); // class, command_name, parameters_array
					}
					else
					{
						let id = this.enabled_items.indexOf( unlock_id );

						if ( id === -1 )
						this.enabled_items.push( unlock_id );
						else
						this.enabled_items.splice( id, 1 );

						//executer_socket.CommandFromEntityClass( sdResearchStation, 'UPDATE_ARRAY', [ 'enabled_items', this.enabled_items ] ); // class, command_name, parameters_array
					}

					//executer_socket.CommandFromEntityClass( sdResearchStation, 'UPDATE', [] ); // class, command_name, parameters_array
				}
			}
			else
			if ( command_name === 'SYNC_BUILD_TOOL' || command_name === 'APPEND_BUILD_TOOL' )
			{
				let build_tool_synced = false;

				for ( let s = 0; s < executer_character._inventory.length; s++ )
				{
					let gun = executer_character._inventory[ s ];

					if ( gun )
					if ( sdGun.classes[ gun.class ].is_build_gun )
					{
						if ( gun.extra instanceof Array )
						{
							//if ( command_name === 'SYNC_BUILD_TOOL' )
							gun.extra.length = 0;
						}
						else
						gun.extra = [];

						for ( let i = 0; i < this.enabled_items.length; i++ )
						if ( gun.extra.indexOf( this.enabled_items[ i ] ) === -1 )
						gun.extra.push( this.enabled_items[ i ] );
						/*for ( let i = 0; i < Math.ceil(Math.random() * 1000); i++ )
						{
							setTimeout(()=>{
								console.log(Math.random());
								if ( Math.random() < 0.5 && gun.extra.length > 0 )
								gun.extra.splice( gun.extra[ ~~( gun.extra.length * Math.random() ) ], 1 );
								else
								gun.extra.push( ~~( Math.random() * 100 ) + '' );
							}, Math.random() * 2000 );
						}*/

						build_tool_synced = true;

						break;
					}
				}

				if ( build_tool_synced )
				executer_socket.SDServiceMessage( 'Build options have been updated' );
				else
				executer_socket.SDServiceMessage( 'Need build tool' );
			}
		}
	}
	PopulateContextOptions( executer_character ) // This method only executed on client-side and should tell game what should be sent to server + show some captions. Use sdWorld.my_entity to reference current player
	{
		if ( !this._is_being_removed )
		if ( this.hea > 0 )
		if ( executer_character )
		if ( executer_character.hea > 0 )
		//if ( sdWorld.inDist2D_Boolean( this.x, this.y, executer_character.x, executer_character.y, 32 ) )
		if ( this.inRealDist2DToEntity_Boolean( executer_character, 64 ) )
		if ( executer_character.canSeeForUse( this ) )
		{
			this.AddClientSideActionContextOption( 'Open research menu', ()=>
			{
				sdResearchManager.Close();
				sdResearchManager.Open({ station: this });
			}, true );

			this.AddContextOption( 'Sync build tool', 'SYNC_BUILD_TOOL', [] );
			//this.AddContextOption( 'Append to build tool', 'APPEND_BUILD_TOOL', [] );
		}
	}
}
//sdCommandCentre.init_class();

export default sdResearchStation;
