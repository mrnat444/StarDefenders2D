/*

	Edit database

*/

/* global sd_events, sdElement */

import sdResearchStation from '../entities/sdResearchStation.js';
import sdElement from './sdElement.js';
import sdInterface from './sdInterface.js';

class sdResearchManager extends sdInterface
{
	static init_class()
	{
		sdResearchManager.only_instance = null;

		sdResearchManager.tile_colors = [
			'#0044ff50', 
			'#ffff0040', 
			'#31ff8740', 
			'#640d0d40', 
			'#ffff0060' 
			];

		sdResearchManager.hint_texts = [
					'Research this item',
					'Stop researching this item',
					'Disable build tool sync for this item',
					'Enable build tool sync for this item'
				];


		sdInterface.interface_classes[ this.name ] = this; // Register for callbacks
	}
	
	static Open( params ) // { lrtp }
	{
		if ( sdResearchManager.only_instance )
		return;
	
		sdResearchManager.only_instance = new sdResearchManager( params );
	}
	
	static Close()
	{
		if ( !sdResearchManager.only_instance )
		return;
	
		sdResearchManager.only_instance.remove();
		sdResearchManager.only_instance = null;
	}
	
	constructor( params )
	{
		super( params );
		
		this.station = params.station;
		
		this.window = sdElement.createElement({ 
			type: sdElement.WINDOW,
			text: 'Research manager', translate: true,
			onCloseButton: ()=>{ sdResearchManager.Close(); },
			draggable: true
		});
		this.window.element.style.cssText = `
			left: calc( 25% - 20px );
			top: 20px;
		
			width: 60%;
			height: 95%;
		`;
		
		let categories = this.window.createElement({ 
			type: sdElement.TEXT_BLOCK, 
			text: ''
		});

		categories.element.style.cssText = `
			overflow-x: auto;
			overflow-y: auto;
			display: flex;
			flex-wrap: wrap;
			justify-self: center;
			font-size: 18px;
		`;

		//categories.element.style.height = '100%';
		//categories.element.style.overflowX = 'auto';
		//categories.element.style.overflowY = 'auto';
		//categories.element.style.width = '100%';
		//categories.element.style.display = 'flex';
		//categories.element.style.flexWrap = 'wrap';
		//categories.element.style.justifySelf = 'center';
		//categories.element.style.fontSize = '18px';

		for ( let i = 0; i < sdShop.item_unlock_categories.length; i++ )
		{
			let element = categories.createElement({ 
				type: sdElement.TEXT, 
				text: sdShop.item_unlock_categories[ i ],
				translate: true,
				marginRight: 4,
				marginLeft: 4,
				marginBottom: 10,
				padding: 10,
				onClick: ()=>
				{
					this.category = sdShop.item_unlock_categories[ i ];
					this.UpdateStructure();
				},

				//element_reuse_key: obj._old_receive_btn
			});

			element.element.style.background = '#00ff0040';
		}

		this.old_objects = null;
	
		this.structure_element = this.window.createElement({ 
			type: sdElement.TEXT_BLOCK, 
			text: ''
		});
		
		this.structure_update_cheduled = false;
		
		this.data = [];

		this.category = 'Base equipment';
		
		this.structure_element.element.style.height = 'calc( 100% - 50px)';
		this.structure_element.element.style.overflowX = 'auto';
		this.structure_element.element.style.overflowY = 'auto';
		this.structure_element.element.style.width = '100%';
		this.structure_element.element.style.fontSize = '12px';

		this.structure_element.element.classList.add( 'sd_scrollbar' );

		this.information = this.structure_element.createElement({ 
			type: sdElement.TEXT_BLOCK, 
			text: ''
		});

		//this.information.element.className = 'sdWindow';
		this.information.element.style.cssText = `
			position: absolute;
			right: 100%;
			top: 44px;
			background: rgba(0,0,0,0.85);
			padding: 10px;
			width: calc( 20% + 100px );
			height: calc( 75% + 100px );
			overflow-y: auto;
			bottom: 20px;
		`;

		/*let hint = this.information.createElement({ 
			type: sdElement.TEXT_BLOCK, 
			text: ''
		});

		hint.element.className = 'sd_window_inner_container';*/

		this.hints = this.information.createElement({ 
			type: sdElement.TEXT_BLOCK, 
			text: 'Matter: ' + this.station.matter + ' / ' + this.station.matter_max
		});

		this.changed_items = 0;

		this.update_timer = setInterval( ()=>
		{
			//this.UpdateTileColors();
			if ( this.station )
			{
				let current_items = this.station.unlocked_items.length + this.station.enabled_items.length + this.station.researching_items.length;
				if ( this.changed_items !== current_items )
				{
					this.changed_items = current_items;
					this.UpdateStructure();
				}
			}
		}, 100 );

		/*this.update_timer = setInterval( ()=>
		{
			this.hints.element.innerText = `
Matter: ${this.station.matter} / ${this.station.matter_max}\n
Data\n
    Crystal: ${this.station.research_data[ sdResearchStation.DATA_CRYSTAL ]}\n
    Organic: ${this.station.research_data[ sdResearchStation.DATA_ORGANIC ]}\n
    Technology: ${this.station.research_data[ sdResearchStation.DATA_TECHNOLOGY ]}\n
    Weapons: ${this.station.research_data[ sdResearchStation.DATA_WEAPON ]}\n
`;
		}, 100 );*/
		
		this.hover_element = this.window.createElement({ 
			type: sdElement.TEXT_BLOCK, 
			text: ''
		});

		this.hover_element.element.style.width = '400px';
		this.hover_element.element.style.height = '200px';
		this.hover_element.element.className = 'sd_window';
		this.hover_element.element.style.pointerEvents = 'none';

		this.hover_element.createElement({ 
			type: sdElement.TEXT_BLOCK, 
			text: 'hover text'
		});

		this.window.element.onmousemove = ( e )=>
		{
			this.hover_element.element.style.visibility = sdElement.hover_element.style.visibility;
			
			if ( sdElement.hover_element.style.visibility === 'visible' )
			{
				this.hover_element.element.style.left = e.clientX + 2 + 'px';
				this.hover_element.element.style.top = e.clientY + 2 + 'px';
			}
		}

		this.RequestData();
		
		this.UpdateStructure();
	}
	
	RequestData()
	{
		globalThis.socket.emit( 'ENTITY_CONTEXT_ACTION', [ this.station.GetClass(), this.station._net_id, 'OPEN_MENU', [] ] );
	}
	
	UpdateStructure()
	{
		this.structure_update_cheduled = true;
		setTimeout( ()=>{ 
			
			if ( this.structure_update_cheduled )
			{
				this.structure_update_cheduled = false;
				
				if ( sdResearchManager.only_instance )
				this._UpdateStructure();
			}
		}, 1 );
	}
	
	_UpdateStructure()
	{
		//this.structure_element.removeChildren();
		
		let new_objects = this.structure_element.createElement({ 
			type: sdElement.TEXT_BLOCK, 
			text: ''
		});
		
		new_objects.element.style.display = 'flex';
		new_objects.element.style.flexWrap = 'wrap';
		new_objects.element.style.justifySelf = 'center';

		if ( this.old_objects )
		this.old_objects.MarkAsOldRecursively();
		
		for ( let i = 0; i < sdShop.options.length; i++ )
		{
			//let obj = this.data[ i ];
			let shop_item = sdShop.options[ i ];

			if ( shop_item._category !== this.category )
			continue;

			let unlock_id = sdShop.GetItemUnlockId( shop_item );

			if ( !unlock_id )
			continue;

			let desc = sdShop.GetFullItemDescription( i );
			
			/*let line_group = new_objects.createElement({ 
				type: sdElement.ROW, 
				text: '',
				margin: 10,
				
				//element_reuse_key: obj._old_line_group
			});*/
			//obj._old_line_group = line_group;
			
			
			//if ( obj.available_after <= 0 )
			{
				const getState = ()=>
				{
					if ( this.station.unlocked_items.indexOf( unlock_id ) === -1 )
					{
						if ( this.station.researching_items.indexOf( unlock_id ) === -1 )
						return 0;

						return 1;
					}

					if ( this.station.enabled_items.indexOf( unlock_id ) !== -1 )
					return 2;

					return 3;
				}

				let state = getState();

				let btn = new_objects.createElement({ 
					type: sdElement.TEXT, 
					text: desc[ 0 ],
					translate: true,
					width: 95,
					height: 95,
					margin: 4,
					onClick: ()=>
					{
						globalThis.socket.emit( 'ENTITY_CONTEXT_ACTION', [ this.station.GetClass(), this.station._net_id, 'TOGGLE_ITEM', [ i ] ] );
					},
					/*onHover: ()=>
					{
						this.hover_element.style.left = 
					}*/

					//element_reuse_key: obj._old_receive_btn
				});
				btn.element.style.background = sdResearchManager.tile_colors[ state ];
				//obj._old_receive_btn = receive_btn;
			}
			/*else
			{
				let receive_btn = line_group.createElement({ 
					type: sdElement.TEXT_BLOCK, 
					text: '',
					width: 100,
					marginRight: 10,

					element_reuse_key: obj._old_receive_btn_disabled
				});
				obj._old_receive_btn_disabled = receive_btn;
			}*/
			
			
			
			/*let text_block = line_group.createElement({ 
				type: sdElement.TEXT_BLOCK, 
				text: '',
				
				//element_reuse_key: obj._old_text_block
			});*/
			//obj._old_text_block = text_block;
			/*{
				let line = text_block.createElement({ 
					type: sdElement.TEXT_BLOCK, 
					text: '',
				
					//element_reuse_key: obj.title + '_line'
				});
				{
					line.createElement({ 
						type: sdElement.TEXT, 
						text: 'Group "',
						translate: true
					});
					line.createElement({ 
						type: sdElement.TEXT, 
						text: desc[ 0 ]
					});
					line.createElement({ 
						type: sdElement.TEXT, 
						text: '" ('
					});
					line.createElement({ 
						type: sdElement.TEXT, 
						text: obj.items
					});
					line.createElement({ 
						type: sdElement.TEXT, 
						text: ' items)',
						translate: true
					});
				}
				
				line = text_block.createElement({ 
					type: sdElement.TEXT_BLOCK, 
					text: '',
				
					//element_reuse_key: obj.title + '_line2'
				});
				if ( obj.available_after > 0 )
				{
					line.createElement({ 
						type: sdElement.TEXT, 
						text: 'Available in ',
						translate: true,
						color: '#ffff00'
					});
					
					if ( obj.available_after < 1000 * 60 )
					{
						line.createElement({ 
							type: sdElement.TEXT, 
							text: Math.ceil( obj.available_after / 1000 ),
							color: '#ffff00'
						});
						line.createElement({ 
							type: sdElement.TEXT, 
							text: ' seconds',
							translate: true,
							color: '#ffff00'
						});
					}
					else
					{
						line.createElement({ 
							type: sdElement.TEXT, 
							text: Math.ceil( obj.available_after / 1000 / 60 ),
							color: '#ffff00'
						});
						line.createElement({ 
							type: sdElement.TEXT, 
							text: ' minutes',
							translate: true,
							color: '#ffff00'
						});
					}
				}
				else
				{
					line.createElement({ 
						type: sdElement.TEXT, 
						text: 'Available now',
						translate: true,
						color: '#00ff00'
					});
				}
			}*/
		}
		
		if ( this.old_objects )
		this.old_objects.remove();
		
		this.old_objects = new_objects;
		
		new_objects.RemoveOldRecursively();
	}

	UpdateTileColors()
	{
		;
	}
	
	static HandleServerCommand( command_name, parameters_array )
	{
		if ( sdResearchManager.only_instance )
		sdResearchManager.only_instance.HandleServerCommand( command_name, parameters_array );
	}
	HandleServerCommand( command_name, parameters_array )
	{
		/*if ( command_name === 'UPDATE_ARRAY' )
		{
			this.station[ parameters_array[ 0 ] ] = parameters_array[ 1 ];
			this.UpdateStructure();
		}*/
		/*else
		if ( command_name === 'UPDATE_UNLOCKED_ARRAY' )
		{
			this.station.unlocked_items = parameters_array[ 0 ];
			this.UpdateStructure();
		}
		else
		if ( command_name === 'UPDATE_ENABLED_ARRAY' )
		{
			this.station.enabled_items = parameters_array[ 0 ];
			this.UpdateStructure();
		}*/
	}
	
	DecreaseTimers( by_how_much )
	{
		
		//this.UpdateStructure();
	}
	
	remove()
	{
		this.window.remove();
		clearInterval( this.update_timer );
	}
}

export default sdResearchManager;