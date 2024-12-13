/*

	Monitors a base and spawns/directs a group of entities toward attacking it at scheduled times

	One sdBaseAttack entity is created for each friendly shield group and scans for targets within their radius

	sdBaseAttack entities will despawn when there are no more friendly shields to target or get targets from, otherwise they will continue scheduling new attacks and increasing intensity after each

*/
import sdWorld from '../sdWorld.js';
import sdEntity from './sdEntity.js';
import sdBaseShieldingUnit from './sdBaseShieldingUnit.js';
import sdCom from './sdCom.js';
import sdCable from './sdCable.js';
import sdEffect from './sdEffect.js';
import sdCharacter from './sdCharacter.js';
import sdRescueTeleport from './sdRescueTeleport.js';
import sdFactions from './sdFactions.js';
import sdWeather from './sdWeather.js';
import sdStatusEffect from './sdStatusEffect.js';
import sdCrystal from './sdCrystal.js';
import sdStorage from './sdStorage.js';
import sdCube from './sdCube.js';
import sdCouncilIncinerator from './sdCouncilIncinerator.js';
import sdZektaronDreadnought from './sdZektaronDreadnought.js';
import sdEnemyMech from './sdEnemyMech.js';
import sdSetrDestroyer from './sdSetrDestroyer.js';
import sdDrone from './sdDrone.js';
import sdMatterAmplifier from './sdMatterAmplifier.js';
import sdCommandCentre from './sdCommandCentre.js';
import sdMatterContainer from './sdMatterContainer.js';
import sdJunk from './sdJunk.js';

class sdBaseAttack extends sdEntity
{
	static init_class()
	{
		sdBaseAttack.TYPE_FALKOK = 0;
		sdBaseAttack.TYPE_COUNCIL = 1;
		sdBaseAttack.TYPE_SARRONIAN = 2; // And Zektaron
		sdBaseAttack.TYPE_VELOX = 3;
		sdBaseAttack.TYPE_SETR = 4;
		sdBaseAttack.TYPE_CUBES = 5; // Not restricted to character-and-drone-based factions, anything could be a base attacker

		sdBaseAttack.attack_types_by_difficulty = [ // Goes from least to most difficult/dangerous
			sdBaseAttack.TYPE_FALKOK,
			sdBaseAttack.TYPE_VELOX,
			sdBaseAttack.TYPE_CUBES,
			sdBaseAttack.TYPE_SARRONIAN,
			sdBaseAttack.TYPE_SETR,
			sdBaseAttack.TYPE_COUNCIL
		]

		sdBaseAttack.all_base_attacks = [];

		sdBaseAttack.shield_units_loop = 0;

		sdBaseAttack.next_shield_group_scan = 0;
		sdBaseAttack.shield_group_scan_frequency = 1000 * 3;

		sdBaseAttack.max_attack_size_per_base_attack = 30; // Measures entities with GetEntitySpawnCost() instead of entity count so that 10 characters isn't the same as 10 enemy mechs for example

		sdBaseAttack.spawn_cost_multiplier = 10;
		sdBaseAttack.attack_strength_influence = 0.1; // Multiplies attack_strength for determining the next attack time and attack type

		sdBaseAttack.min_initial_base_strength = 1; // bases will be ignored until they have matter strength above this
		
		sdWorld.entity_classes[ this.name ] = this; // Register for object spawn
	}
	get hitbox_x1() { return 0; }
	get hitbox_x2() { return 0; }
	get hitbox_y1() { return 0; }
	get hitbox_y2() { return 0; }

	get hard_collision() // For world geometry where players can walk
	{ return false; }

	//IsGlobalEntity()
	//{ return true; }
	
	constructor( params )
	{
		super( params );

		this.active = false;

		this.attack_strength = params.attack_strength || 1;
		this.spawn_credits = 0;
		this._current_attack_size = 0;

		this.type = params.type || this.GetRandomAttackType();

		this._next_attacker_spawn = 0;

		this.shield_targets = [];
		this._shield_target_id = 0;

		this._next_shield_scan = 0;

		this._targets_by_net_id = [];
		this._target_id = 0;

		this._attackers_by_net_id = [];
		this._attacker_costs = [];
		this._attacker_id = 0;

		this.next_attack_time = this.GetNextAttackTime();

		this.SetMethod( 'CrystalRemoved', this.CrystalRemoved );

		sdBaseAttack.all_base_attacks.push( this );
	}

	static UpdateBaseAttackProp( ent ) // Also adds the entity to the base attack's _attackers_by_net_id and _attacker_costs arrays
	{
		if ( !sdWorld.is_server )
		return;

		if ( typeof ent._base_attack === 'undefined' )
		return;

		let ent_attack_type = sdBaseAttack.GetEntityAttackType( ent );

		if ( ent_attack_type === -1 )
		{
			if ( ent._base_attack )
			ent._base_attack = null;

			return;
		}

		if ( !ent._base_attack || ent._base_attack._is_being_removed || ent._base_attack.type !== ent_attack_type || !ent._base_attack.active )
		ent._base_attack = null;

		if ( !ent._base_attack ) // Find a new base attack for the entity to join
		{
			let matching_attacks = [];
	
			for ( let i = 0; i < sdBaseAttack.all_base_attacks.length; i++ )
			{
				let attack = sdBaseAttack.all_base_attacks[ i ];
	
				if ( attack && !attack._is_being_removed )
				if ( attack.active )
				if ( attack.type === ent_attack_type )
				matching_attacks.push( attack );
			}

			if ( matching_attacks.length > 0 )
			ent._base_attack = matching_attacks[ ~~( Math.random() * matching_attacks.length ) ];
		}

		if ( ent._base_attack )
		{
			if ( ent._base_attack._attackers_by_net_id.indexOf( ent._net_id ) === -1 )
			{
				let cost = sdBaseAttack.GetEntitySpawnCost( ent );

				ent._base_attack._attackers_by_net_id.push( ent._net_id );
				ent._base_attack._attacker_costs.push( cost );

				ent._base_attack.spawn_credits -= cost;
				ent._base_attack._current_attack_size += cost;

				console.log(ent._base_attack._current_attack_size);
			}
		}
	}

	static GetEntityAttackType( ent )
	{
		if ( !ent || ent._is_being_removed )
		return -1;

		//if ( ( ent.hea || ent._hea || 0 ) <= 0 && !ent.is( sdCube ) )
		//return -1;

		if ( typeof ent._ai_team !== 'undefined' )
		{
			if ( ent._ai_team === sdFactions.TEAM_FALKOK )
			return sdBaseAttack.TYPE_FALKOK;

			if ( ent._ai_team === sdFactions.TEAM_COUNCIL )
			return sdBaseAttack.TYPE_COUNCIL;

			if ( ent._ai_team === sdFactions.TEAM_SARRONIAN )
			return sdBaseAttack.TYPE_SARRONIAN;
		
			if ( ent._ai_team === sdFactions.TEAM_VELOX )
			return sdBaseAttack.TYPE_VELOX;

			if ( ent._ai_team === sdFactions.TEAM_SETR )
			return sdBaseAttack.TYPE_SETR;

			return -1;
		}

		let c = ent.GetClass();

		if ( c === 'sdCube' && ent.kind !== sdCube.KIND_MATTER_STEALER )
		return sdBaseAttack.TYPE_CUBES;

		return -1;
	}
	static GetEntitySpawnCost( ent )
	{
		let hea = ( ent.hea || ent._hea || 0 );

		if ( hea <= 0 )
		return 0;

		return ( 1 + hea * 0.001 ) * sdBaseAttack.spawn_cost_multiplier;
		//return Math.ceil( Math.pow( hea, 0.5 ) * sdBaseAttack.spawn_cost_multiplier );
	}

	static GetBaseMatterStrength( friendly_shield_arr ) // Measures and returns the combined strength of connected shields
	{
		if ( !friendly_shield_arr || friendly_shield_arr.length <= 0 )
		return 0;

		let strength = 0;

		const visited_ent_flag = sdEntity.GetUniqueFlagValue();

		//const FilterHasMatterGlow = ( e )=> { return e.onThink.has_MatterGlow };

		for ( let i = 0; i < friendly_shield_arr.length; i++ )
		{
			let shield = friendly_shield_arr[ i ];

			if ( sdBaseShieldingUnit.targetable_shield_types_for_base_attacks.indexOf( shield.type ) === -1 )
			continue;

			if ( shield.type === sdBaseShieldingUnit.TYPE_CRYSTAL_CONSUMER )
			{
				strength += shield.matter_crystal * 3; // Green shields drain slower, don't have continual matter supply, and damage attacker
				continue;
			}

			let nears = sdWorld.GetAnythingNear( shield.x, shield.y, sdBaseShieldingUnit.protect_distance, null, [ 'sdCrystal', 'sdMatterContainer', 'sdJunk' ] );

			for ( let i = 0; i < nears.length; i++ )
			{
				let e = nears[ i ];

				if ( e._is_being_removed || e._flag === visited_ent_flag )
				continue;

				e._flag = visited_ent_flag;

				if ( e.is( sdCrystal ) )
				{
					if ( e.held_by && !e.held_by._is_being_removed && e.held_by.is( sdMatterAmplifier ) )
					strength += e.matter_max * ( e.matter_regen / 100 ) * e.held_by.multiplier;
					else
					strength += e.matter_max * ( e.matter_regen / 100 );

					strength += e.matter * 0.01;
				}
				else
				if ( e.is( sdMatterContainer ) || ( e.is( sdJunk ) && e.type === sdJunk.TYPE_ADVANCED_MATTER_CONTAINER ) )
				{
					strength += e.matter * 0.01;
				}
			}
		}

		return Math.pow( strength, 0.5 );
	}

	static TargetableShieldFilter( ent )
	{
		return ent.is( sdBaseShieldingUnit ) && sdBaseShieldingUnit.targetable_shield_types_for_base_attacks.indexOf( ent.type ) !== -1;
	}
	static BaseEntityFilter( ent )
	{
		if ( !ent.hard_collision || ent.IsBGEntity() !== 0 )
		return false;

		let c = ent.GetClass();
		if ( c === 'sdCrystal' || c === 'sdStorage' || c === 'sdBaseShieldingUnit' || c === 'sdRescueTeleport' )
		return true;

		//if ( typeof ent._shielded !== 'undefined' && ent._shielded && !ent._shielded._is_being_removed )
		//return true;

		return false;
	}

	CrystalRemoved( ent ) // (Kind of redundant) Prevent players from despawning crystals via crystal crates to remove them from the targets array
	{
		if ( !ent._broken ) // Possibly removed by a storage crate or crystal combiner
		{
			let nears = sdWorld.GetAnythingNear( ent.x, ent.y, 32, null, [ 'sdStorage', 'sdCrystal' ] );
			for ( let i = 0; i < nears.length; i++ )
			if ( !nears[ i ]._is_being_removed )
			{
				let e = nears[ i ];

				if ( this._targets_by_net_id.indexOf( e._net_id ) === -1 )
				this._targets_by_net_id.push( e._net_id );

				if ( e.is( sdStorage ) )
				{
					for ( let j = 0; j < e._stored_items.length; j++ )
					{
						if ( e._stored_items[ j ].indexOf( ent._net_id ) !== -1 )
						{
							// Add the _net_id to a Set() of despawned items or something
						}
					}
				}
				else
				if ( e.is( sdCrystal ) )
				if ( Math.abs( ent.x - e.x ) < 0.01 && Math.abs( ent.y - e.y ) < 0.01 ) // Crystals were likely combined
				{
					e.addEventListener( 'REMOVAL', this.CrystalRemoved );
				}
			}
		}

		ent.removeEventListener( 'REMOVAL', this.CrystalRemoved );
	}

	GetAiTeam()
	{
		if ( this.type === sdBaseAttack.TYPE_FALKOK )
		return sdFactions.TEAM_FALKOK;

		if ( this.type === sdBaseAttack.TYPE_COUNCIL )
		return sdFactions.TEAM_COUNCIL;

		if ( this.type === sdBaseAttack.TYPE_SARRONIAN )
		return sdFactions.TEAM_SARRONIAN;

		if ( this.type === sdBaseAttack.TYPE_VELOX )
		return sdFactions.TEAM_VELOX;

		if ( this.type === sdBaseAttack.TYPE_SETR )
		return sdFactions.TEAM_SETR;

		return -1;
	}
	GetNextAttackTime() // Attacks become more frequent as attack strength increases
	{
		let min_time = sdWorld.server_config.base_attacks_min_time_between_each;
		let max_time = sdWorld.server_config.base_attacks_max_time_between_each;

		let t = 1 + Math.max( 0, this.attack_strength * sdBaseAttack.attack_strength_influence + ( Math.random() * 2 - 1 ) * 0.01 );

		return sdWorld.time + min_time + ( max_time - min_time ) / t;
	}
	GetRandomAttackType() // Attack strength increases the chance of getting stronger attack types
	{
		let r = 1 - Math.pow( Math.random(), this.attack_strength * sdBaseAttack.attack_strength_influence );

		return sdBaseAttack.attack_types_by_difficulty[ ~~( sdBaseAttack.attack_types_by_difficulty.length * r ) ];
	}
	GetRandomBaseTarget( ent, get_closest=false )
	{
		if ( this._targets_by_net_id.length <= 0 )
		{
			if ( this.shield_targets.length > 0 )
			{
				let s = this.shield_targets[ ~~( Math.random() * this.shield_targets.length ) ];
				if ( s && !s._is_being_removed )
				return s;
			}

			return null;
		}

		let closest = null;
		let best_di = 0;

		let i = ~~( Math.random() * this._targets_by_net_id.length ); // Avoid shuffling the array since that would probably mess with realtime target looping at onThink
		let tot = 0;

		do
		{
			i = ( i + 1 ) % this._targets_by_net_id.length;
			tot++;

			let target = sdEntity.GetObjectByClassAndNetId( 'auto', this._targets_by_net_id[ i ] );

			if ( !target || target._is_being_removed )
			{
				this._targets_by_net_id.splice( i, 1 );
				tot--;
				continue;
			}

			if ( !get_closest )
			return target;
			
			let di = sdWorld.Dist2D_Vector_pow2( target.x - ent.x, target.y - ent.y );

			if ( !closest || di < best_di )
			{
				closest = target;
				best_di = di;
			}
		} while ( tot < this._targets_by_net_id.length )

		if ( closest && !closest._is_being_removed )
		return closest;

		return null;
	}
	IsEntityTargeted( ent )
	{
		if ( !ent || ent._is_being_removed )
		return false;

		return this._targets_by_net_id.indexOf( ent._net_id ) !== -1;
	}
	SpawnAttacker()
	{
		if ( this.type === sdBaseAttack.TYPE_CUBES )
		{
			sdWeather.SimpleSpawner({

				count: [ 1, 1 ],
				class: sdCube,
				params: { _base_attack: ()=>{ return this }, kind: ()=>sdCube.GetRandomKind() },
				evalute_params: [ '_base_attack', 'kind' ],
				
				aerial: true
	
			});

			return;
		}

		let params = { 
			_base_attack: ()=>{ return this }, 
			_ai_team: ()=>this.GetAiTeam() 
		};
		let evalute_params = [ '_base_attack', '_ai_team' ];

		let spawns_drones = false;
		let spawns_characters = false;

		if ( // Attack types that include drones (besides support ones like Council and Setr)
			this.type === sdBaseAttack.TYPE_FALKOK || 
			this.type === sdBaseAttack.TYPE_SARRONIAN
		)
		spawns_drones = true;

		if ( // Attack types that include characters
			this.type === sdBaseAttack.TYPE_FALKOK || 
			this.type === sdBaseAttack.TYPE_COUNCIL || 
			this.type === sdBaseAttack.TYPE_SARRONIAN || 
			this.type === sdBaseAttack.TYPE_VELOX || 
			this.type === sdBaseAttack.TYPE_SETR
		)
		spawns_characters = true;

		let boss_spawn_chance = 
		this.type === sdBaseAttack.TYPE_COUNCIL ? 0.05 : 
		this.type === sdBaseAttack.TYPE_SARRONIAN ? 0.01 : 
		this.type === sdBaseAttack.TYPE_VELOX ? 0.07 : 
		this.type === sdBaseAttack.TYPE_SETR ? 0.1 : 
		0.01;

		if ( ( !spawns_drones && !spawns_characters ) || Math.random() < boss_spawn_chance ) // Boss enemy
		{
			let c = 
				this.type === sdBaseAttack.TYPE_FALKOK ? sdCharacter : // Sword bot
				this.type === sdBaseAttack.TYPE_COUNCIL ? sdCouncilIncinerator : 
				this.type === sdBaseAttack.TYPE_SARRONIAN ? sdZektaronDreadnought : 
				this.type === sdBaseAttack.TYPE_VELOX ? sdEnemyMech : 
				this.type === sdBaseAttack.TYPE_SETR ? sdSetrDestroyer : 
				null;

			if ( !c )
			return;

			if ( c === sdCharacter )
			{
				let character_entity = new sdCharacter({ x:0, y:0, _ai_enabled:sdCharacter.AI_MODEL_AGGRESSIVE });

				sdEntity.entities.push( character_entity );

				if ( !sdWeather.SetRandomSpawnLocation( character_entity ) )
				{
					character_entity.remove();
					character_entity._broken = false;
				}
				else
				sdFactions.SetHumanoidProperties( character_entity, sdFactions.FACTION_FALKONIAN_SWORD_BOT );
			}
			else
			{
				sdWeather.SimpleSpawner({

					count: [ 1, 1 ],
					class: c,
					params: params,
					evalute_params: evalute_params,
					
					aerial: true
		
				});
			}
		}
		else
		{
			if ( !spawns_characters || ( spawns_drones && Math.random() < 0.5 ) )
			{
				let r = Math.random();

				let type = 
				this.type === sdBaseAttack.TYPE_SARRONIAN ? 
				( 
					r * 4 < 1 ? sdDrone.DRONE_SARRONIAN : 
					r * 4 < 2 ? sdDrone.DRONE_SARRONIAN_DETONATOR_CARRIER : 
					r * 4 < 3 ? sdDrone.DRONE_SARRONIAN_GAUSS :
					sdDrone.DRONE_ZEKTARON_CORVETTE
				) : 
				( 
					r < 0.5 ? sdDrone.DRONE_FALKOK : 
					sdDrone.DRONE_FALKOK_RAIL 
				);

				params.type = ()=>{ return type };
				evalute_params.push( 'type' );

				sdWeather.SimpleSpawner({

					count: [ 1, 1 ],
					class: sdDrone,
					params: params,
					evalute_params: evalute_params,
					
					aerial: true
		
				});
			}
			else
			{
				let faction = 
					this.type === sdBaseAttack.TYPE_COUNCIL ? sdFactions.FACTION_COUNCIL : 
					this.type === sdBaseAttack.TYPE_SARRONIAN ? sdFactions.FACTION_SARRONIAN : 
					this.type === sdBaseAttack.TYPE_VELOX ? sdFactions.FACTION_VELOX : 
					this.type === sdBaseAttack.TYPE_SETR ? sdFactions.FACTION_SETR : 
					sdFactions.FACTION_FALKOK;

				let character_entity = new sdCharacter({ x:0, y:0, _ai_enabled:sdCharacter.AI_MODEL_AGGRESSIVE });

				sdEntity.entities.push( character_entity );

				if ( !sdWeather.SetRandomSpawnLocation( character_entity ) )
				{
					character_entity.remove();
					character_entity._broken = false;
				}
				else
				{
					sdFactions.SetHumanoidProperties( character_entity, faction );

					character_entity.disowned_body_ttl = 30 * 10;
				}
			}
		}
	}

	static GlobalThink( GSPEED )
	{
		if ( sdBaseShieldingUnit.all_shield_units.length > 0 && sdBaseAttack.next_shield_group_scan < sdWorld.time )
		{
			sdBaseAttack.next_shield_group_scan = sdWorld.time + sdBaseAttack.shield_group_scan_frequency * 0.5 + Math.random() * sdBaseAttack.shield_group_scan_frequency * 0.5;

			sdBaseAttack.shield_units_loop = ( sdBaseAttack.shield_units_loop + 1 ) % sdBaseShieldingUnit.all_shield_units.length;
			let shield = sdBaseShieldingUnit.all_shield_units[ sdBaseAttack.shield_units_loop ];

			if ( 
				!shield || shield._is_being_removed || 
				shield._enabled_shields_in_network_count <= 0 || 
				shield._protected_entities.length <= 0 || 
				sdBaseShieldingUnit.targetable_shield_types_for_base_attacks.indexOf( shield.type ) === -1 
			)
			return;

			let friendly_shields = shield.FindObjectsInACableNetwork( sdBaseAttack.TargetableShieldFilter );
			if ( friendly_shields.indexOf( shield ) === -1 )
			friendly_shields.push( shield );

			if ( sdBaseAttack.all_base_attacks.length > 0 ) // Make sure that shields are not already targeted
			{
				for ( let i = 0; i < friendly_shields.length; i++ )
				if ( !friendly_shields[ i ]._is_being_removed )
				{
					let s = friendly_shields[ i ];

					if ( s._base_attack_threat )
					return;
	
					/*for ( let i2 = 0; i2 < sdBaseAttack.all_base_attacks.length; i2++ )
					{
						let b = sdBaseAttack.all_base_attacks[ i2 ];
		
						if ( !b._is_being_removed )
						if ( b._shield_targets.indexOf( s ) !== -1 )
						return;
					}*/
				}
			}

			let attack_strength = sdBaseAttack.GetBaseMatterStrength( friendly_shields ) * 0.25; // Start at a quarter of the base's strength

			let attack = new sdBaseAttack({ x:0, y:0, attack_strength:attack_strength });

			sdEntity.entities.push( attack );

			for ( let i = 0; i < friendly_shields.length; i++ )
			if ( !friendly_shields[ i ]._is_being_removed )
			attack.shield_targets.push( friendly_shields[ i ] );
		}
	}

	onThink( GSPEED )
	{
		if ( !sdWorld.is_server )
		return;

		if ( this.shield_targets.length > 0 )
		{
			this._shield_target_id = ( this._shield_target_id + 1 ) % this.shield_targets.length;
			let shield = this.shield_targets[ this._shield_target_id ];

			if ( shield && !shield._is_being_removed )
			{
				if ( shield._base_attack_threat !== this )
				{
					let other_attack = shield._base_attack_threat;

					if ( other_attack && !other_attack._is_being_removed && other_attack._shield_targets.indexOf( shield ) !== -1 ) // Shield is already targeted by another attack
					{
						let friendly_shields = shield.FindObjectsInACableNetwork( null, sdBaseShieldingUnit );
						if ( friendly_shields.indexOf( shield ) === -1 )
						friendly_shields.push( shield );

						for ( let i = 0; i < friendly_shields.length; i++ )
						{
							let s = friendly_shields[ i ];

							let id = this.shield_targets.indexOf( s );
							if ( id !== -1 )
							this.shield_targets.splice( id, 1 );

							if ( s._base_attack_threat !== other_attack )
							s._base_attack_threat = other_attack;
						}

						let should_merge_attacks = true;

						if ( this.shield_targets.length > 0 )
						{
							for ( let i = 0; i < this.shield_targets.length; i++ )
							{
								let s = this.shield_targets[ i ];

								if ( s && !s._is_being_removed )
								if ( s.enabled && s._protected_entities.length > 0 )
								{
									should_merge_attacks = false;
									break;
								}
							}
						}

						if ( should_merge_attacks )
						{
							other_attack.active = this.active || other_attack.active;

							other_attack.attack_strength = Math.max( other_attack.attack_strength, this.attack_strength );
							other_attack.spawn_credits = Math.max( other_attack.spawn_credits, this.spawn_credits );

							for ( let i = 0; i < this.shield_targets.length; i++ )
							if ( other_attack._shield_targets.indexOf( this.shield_targets[ i ] ) === -1 )
							other_attack._shield_targets.push( this.shield_targets[ i ] );

							for ( let i = 0; i < this._targets_by_net_id.length; i++ )
							if ( other_attack._targets_by_net_id.indexOf( this._targets_by_net_id[ i ] ) === -1 )
							other_attack._targets_by_net_id.push( this._targets_by_net_id[ i ] );

							this.remove();
							return;
						}
					}
					else
					shield._base_attack_threat = this;
				}

				this.x = shield.x;
				this.y = shield.y;

				if ( this._next_shield_scan < sdWorld.time )
				{
					this._next_shield_scan = sdWorld.time + 500 + Math.random() * 500;
		
					if ( shield.enabled )
					{
						let nears = sdWorld.GetAnythingNear( shield.x, shield.y, sdBaseShieldingUnit.protect_distance, null, null, sdBaseAttack.BaseEntityFilter );
						for ( let i = 0; i < nears.length; i++ )
						{
							let e = nears[ i ];
			
							if ( e && !e._is_being_removed )
							if ( this._targets_by_net_id.indexOf( e._net_id ) === -1 )
							{
								this._targets_by_net_id.push( e._net_id );
		
								if ( e.is( sdCrystal ) )
								{
									if ( !e.hasEventListener( 'REMOVAL', this.CrystalRemoved ) )
									e.addEventListener( 'REMOVAL', this.CrystalRemoved );
								}
							}
						}
					}
	
					let friendly_shields = shield.FindObjectsInACableNetwork( sdBaseAttack.TargetableShieldFilter );
					for ( let i = 0; i < friendly_shields.length; i++ )
					if ( !friendly_shields[ i ]._is_being_removed )
					{
						let s = friendly_shields[ i ];
	
						if ( this.shield_targets.indexOf( s ) === -1 )
						this.shield_targets.push( s );

						if ( !s._base_attack_threat || s._base_attack_threat._is_being_removed )
						s._base_attack_threat = this;
					}
				}
			}
			else
			this.shield_targets.splice( this._shield_target_id, 1 );
		}

		if ( this._targets_by_net_id.length > 0 )
		{
			this._target_id = ( this._target_id + 1 ) % this._targets_by_net_id.length;

			let ent = sdEntity.GetObjectByClassAndNetId( 'auto', this._targets_by_net_id[ this._target_id ] );

			if ( !ent || ent._is_being_removed )//|| ( sdBaseShieldingUnit.IsShieldableFilter( ent ) && !ent._shielded ) )
			this._targets_by_net_id.splice( this._target_id, 1 );
			else
			{
				if ( ent.is( sdCrystal ) )
				{
					if ( !ent.hasEventListener( 'REMOVAL', this.CrystalRemoved ) )
					ent.addEventListener( 'REMOVAL', this.CrystalRemoved );
				}
				else
				if ( ent.is( sdCommandCentre ) )
				{
					if ( !ent.base_attack_threat !== this )
					ent.base_attack_threat = this;
				}
			}
		}

		if ( this._attackers_by_net_id.length > 0 )
		{
			this._attacker_id = ( this._attacker_id + 1 ) % this._attackers_by_net_id.length;

			let ent = sdEntity.GetObjectByClassAndNetId( 'auto', this._attackers_by_net_id[ this._attacker_id ] );

			if ( !this.active || !ent || ent._is_being_removed || sdBaseAttack.GetEntityAttackType( ent ) !== this.type )
			{
				this._attackers_by_net_id.splice( this._attacker_id, 1 );

				this._current_attack_size -= this._attacker_costs[ this._attacker_id ];
				this._attacker_costs.splice( this._attacker_id, 1 );
			}
		}

		if ( this.next_attack_time < sdWorld.time )
		if ( !this.active )
		{
			let active_attacks = 0;

			for ( let i = 0; i < sdBaseAttack.all_base_attacks.length; i++ )
			{
				if ( sdBaseAttack.all_base_attacks[ i ].active )
				active_attacks++;
			}

			if ( active_attacks < sdWorld.server_config.base_attacks_max_active_at_once )
			{
				this.active = true;

				this.spawn_credits = this.attack_strength;
			}
			else
			this.next_attack_time = this.GetNextAttackTime();
		}

		if ( this.active )
		{
			if ( this._current_attack_size < sdBaseAttack.max_attack_size_per_base_attack && this._attackers_by_net_id.length < 20 )
			{
				if ( this.spawn_credits > 0 )
				{
					if ( this._next_attacker_spawn < sdWorld.time )
					{
						this._next_attacker_spawn = sdWorld.time + 1000 * 2 + Math.random() * 1000 * 2;
	
						this.SpawnAttacker();
					}
				}
				else
				{
					if ( this._current_attack_size <= sdBaseAttack.max_attack_size_per_base_attack * 0.1 )
					{
						this.active = false;

						this.type = this.GetRandomAttackType();
	
						let base_strength = sdBaseAttack.GetBaseMatterStrength( this.shield_targets );
						this.attack_strength = Math.max( base_strength * 0.25, this.attack_strength + sdWorld.server_config.base_attacks_scale_rate );

						this.next_attack_time = this.GetNextAttackTime();
					}
				}
			}
		}

		if ( this.shield_targets.length <= 0 && this._targets_by_net_id.length <= 0 )
		this.remove();
	}

	onRemove()
	{
		for ( let i = 0; i < this.shield_targets.length; i++ )
		this.shield_targets[ i ]._base_attack_threat = null;

		for ( let i = 0; i < this._targets_by_net_id.length; i++ )
		{
			let ent = sdEntity.GetObjectByClassAndNetId( 'auto', this._targets_by_net_id[ this._target_id ] );

			if ( ent && !ent._is_being_removed && ent.is( sdCommandCentre ) )
			ent.base_attack_threat = null;
		}

		let id = sdBaseAttack.all_base_attacks.indexOf( this );
		if ( id !== -1 )
		sdBaseAttack.all_base_attacks.splice( id, 1 );
	}
}

export default sdBaseAttack;
