/*

	Whenever you will start new server instance, server_config.js file will be made using this file as template. Class sdServerConfigShort specifically, but you can add methods from sdServerConfigFull to server_config.js too

*/
class sdServerConfigShort
{
	// This file should contain one object (for example class like this one), it will be interpreted using basic eval method and automatically assigned to global variable sdWorld.server_config
			
	// If this all looks scary and you are using NetBeans - use "Ctrl + -" and "Ctrl + *" to hide big methods.
	
	static game_title = 'Star Defenders';
	
	static allowed_s2s_protocol_ips = [
		'127.0.0.1',
		'::1',
		'::ffff:127.0.0.1'
	];
	
	static database_server = null; // Example: 'https://www.gevanni.com:3000'; // Remote database_server must allow current server's IP in list above. Set as null if this server should have its' own database
		
	static notify_about_failed_s2s_attempts = true;
	
	static log_s2s_messages = false;
	
	static skip_arrival_sequence = false; // Skipping it will prevent players from spawning together pretty much. It is useful during tests though.
	
	// Setting both 'enable_bounds_move' and 'aggressive_hibernation' will enable open world support
	static enable_bounds_move = false;
	static aggressive_hibernation = false; // Offscreen groups of entities (sometimes whole bases) will be put to sleep until something tries to access these areas
	
	static apply_censorship = true; // Censorship file is not included
		
	// Check file sdServerConfig.js for more stuff to alter in server logic
	
	static supported_languages = [ 'en', 'ua', 'hr' ];
}


class sdServerConfigFull extends sdServerConfigShort
{
	// ...
	
	static database_server = null; // Example: 'https://www.gevanni.com:3000'; // Remote database_server must allow current server's IP in list above. Set as null if this server should have its' own database
	
	static adsense_client = 'ca-pub-7381466440820611'; // To learn how to install your ads go there https://developers.google.com/ad-placement/docs/beta . This adsense_client comes from HTML code for AdSense. You'll additionally be requested to allow ads on your domain via ads.txt file. Your server will not show ads designed for other servers and vice versa
	
	static save_raw_version_of_snapshot = true; // One that can be easily viewed in Notepad-like applications. It is never used within server logic. "true" can slow-down snapshot generation.
	
	static store_game_files_in_ram = false; // Will make server never use hard drive without need until next reboot, except for cases when backup is being made (more RAM usage, can be suitable for VPS servers that have strange Disk I/O issues)
	
	static offscreen_behavior = 'OFFSCREEN_BEHAVIOR_SIMULATE_X_STEPS_AT_ONCE'; // Or 'OFFSCREEN_BEHAVIOR_SIMULATE_PROPERLY' or 'OFFSCREEN_BEHAVIOR_SIMULATE_X_TIMES_SLOWER' or 'OFFSCREEN_BEHAVIOR_SIMULATE_X_STEPS_AT_ONCE'. We cheat a little bit offscreen as huge/dense worlds would have perforamnce issues otherwise
	static offscreen_behavior_x_value = 30; // By how much slower or how many steps to do at once. Usually 30 can give 2x performance improvement in case of OFFSCREEN_BEHAVIOR_SIMULATE_X_STEPS_AT_ONCE. You can test if anything goes wrong offscreen by enabling debug_offscreen_behavior
	static debug_offscreen_behavior = false; // If you want to see how everything moves offscreen - set this to true
	static TestIfShouldForceProperSimulation( ent ) // Some entities must be synced accurately even if they are offscreen, for example crystals in amplifiers, sdSandWorm, sdQuadro
	{
		if ( ent.is( sdCrystal ) )
		{
			if ( ent.held_by )
			return true;
		}
		else
		//if ( ent.is( sdCube ) || ent.is( sdHover ) || ent.is( sdMatterContainer ) || ent.is( sdSunPanel ) )
		if ( ent.onThink.has_MatterGlow )
		{
			if ( sdCable.connected_entities_per_entity.has( ent ) )
			return true;
		}
		else
		if ( ent.is( sdSandWorm ) )
		{
			if ( ( ent.towards_tail && !ent.towards_tail._is_being_removed ) || ( ent.towards_head && !ent.towards_head._is_being_removed ) )
			if ( ent._phys_sleep > 0 )
			return true;
		}
		else
		if ( ent.is( sdQuadro ) )
		{
			if ( ent.w1 || ent.w2 || ent.p )
			if ( ent._phys_sleep > 0 )
			return true;
		}
		else
		return false;
	}
	
	static base_degradation = true; // False will disable roach attacks, BSU value decrease, crystal matter regeneration rate decrease, flesh corruption removing protection off blocks
	
	static base_shielding_units_passive_drain_per_week_green = 0.01; // 0.2 // Percentage. Also applied to matter amplifiers so green BSUs drain as fast as blue BSUs
	static base_shielding_units_passive_drain_per_week_blue = 0.01; // 0.2 // Percentage. Also applied to matter amplifiers so green BSUs drain as fast as blue BSUs
	
	
	static allowed_base_shielding_unit_types = null; // [ sdBaseShieldingUnit.TYPE_CRYSTAL_CONSUMER, sdBaseShieldingUnit.TYPE_MATTER, sdBaseShieldingUnit.TYPE_SCORE_TIMED ] to allow specific ones or null to allow all
	
	static open_world_max_distance_from_zero_coordinates_x = 40000; // Greater values work just fine, but do you really want this on your server? It can only cause lags.
	static open_world_max_distance_from_zero_coordinates_y_min = -3000; // Greater values work just fine, but do you really want this on your server? It can only cause lags.
	static open_world_max_distance_from_zero_coordinates_y_max = 40000; // Greater values work just fine, but do you really want this on your server? It can only cause lags.
	
	static player_vs_player_damage_scale = 3;
	
	static LinkPlayerMatterCapacityToScore( character )
	{
		return true;
	}
	
	static GetLineOfSightMode( character )
	{
		if ( character._god || character.is( sdPlayerSpectator ) )
		return false;
	
		return true;
	}
	
	static GetHitAllowed( bullet_or_sword, target )
	{
		// Cancel damage from bullet_or_sword towards target. ( bullet_or_sword._owner || bullet_or_sword._dangerous_from ) is a possible owner (can be null)
			
		return true;
	}
	
	static GetSocketScore( socket )
	{
		// Alternates return value of socket.GetScore() which is used for leaderboard
			
		return socket.character ? socket.character._score : 0;
	}
		
	static onDamage( target, initiator, dmg, headshot )
	{
		// Player (initiator, can be null in case of self-damage) damaged another player (target)
		
		if ( initiator )
		if ( initiator.is( sdCharacter ) )
		if ( initiator._socket )
		if ( sdWorld.time >= target._non_innocent_until ) // Check if victim is innocent
		initiator._non_innocent_until = sdWorld.time + 1000 * 30;
	}
	static onKill( target, initiator=null )
	{
		// Player (initiator) killed another player (target)
		
		// Check if initiator exists, is a sdCharacter and has player behind him
		if ( initiator )
		if ( initiator.is( sdCharacter ) )
		if ( initiator._socket )
		if ( !target._ai_enabled ) // Make sure not a real player is being killed
		if ( sdWorld.time < initiator._non_innocent_until ) // Attacker is not innocent
		{
			if ( initiator._socket.ffa_warning === 0 )
			initiator._socket.SDServiceMessage( 'Your respawn rate was temporarily decreased' );

			if ( initiator._socket.SyncFFAWarning ) // Singleplayer does not have it yet
			initiator._socket.SyncFFAWarning();
			
			initiator._socket.ffa_warning += 1;
			initiator._socket.respawn_block_until = sdWorld.time + initiator._socket.ffa_warning * 5000;
		}
	}
			
	static GetAllowedWorldEvents()
	{
		return undefined; // Return array of allowed event IDs or "undefined" to allow them all
	}
	static GetDisallowedWorldEvents()
	{
		return []; // Return array of disallowed event IDs. Has higher priority over GetAllowedWorldEvents() and can be used to allow any new events that will be added to the game with updates
	}
	static GetAllowedWorldEventCount()
	{
		return 6; // Return number of allowed events to happen during planet day
	}
	static GetEventSpeed()
	{
		return 30 * 60 * 3 * ( 3 / 2 ); // Return max possible time until next event rolls
	}
	static GetBSUDamageMultiplier()
	{
		return 1; // Damage multiplier from damaging blocks proteced by BSU.
	}		
	static onExtraWorldLogic( GSPEED )
	{
	}
			
	static ResetScoreOnDeath( character_entity )
	{
		return true;
	}
			
	static onDisconnect( character_entity, reason ) // reason can be either 'disconnected' (connection lost) or 'manual' (player right clicked on himself or pressed Space while dead)
	{
		// Player lost control over sdCharacter (does not include full death case). Note that in case of reason being 'manual' player will get damage equal to his .hea (health) value.
		
	}
			
	static onReconnect( character_entity, player_settings )
	{
		// Player was reconnected. Alternatively onRespawn can be called
		
	}
	
	static AllowAggressiveHibernationFor( entity )
	{
		if ( entity === sdWorld.server_config.new_player_delivery_hover )
		if ( entity.hea > 0 )
		return false;

		return true;
	}
	static SendNewPlayerDeliveryHoverAway()
	{
		if ( sdWorld.server_config.new_player_delivery_hover )
		{
			let hover = sdWorld.server_config.new_player_delivery_hover;
			
			sdWorld.server_config.new_player_delivery_hover = null;
			
			if ( hover.driver0 )
			if ( !hover.driver0._is_being_removed )
			{
				hover.driver0._key_states.SetKey( 'KeyW', 1 );

				hover.driver0.Say( [
					'Yeah... I\'m out of here',
					'Welp, bad landing',
					'I\'ll be somewhere else thank you very much',
					'This place is too much fun',
					'Yeah, good luck it is'
				][ ~~( Math.random() * 5 ) ], false );
			}
			
			setTimeout( ()=>{
				
				if ( !hover._is_being_removed )
				{
					if ( hover.driver0 )
					if ( !hover.driver0._is_being_removed )
					{
						hover.driver0.remove();
						hover.driver0._broken = false;
					}

					hover.remove();
					hover._broken = false;
				}
				
			}, 5000 )
		}
	}
	static onRespawn( character_entity, player_settings )
	{
		// Player just fully respawned. Best moment to give him guns for example. Alternatively onReconnect can be called
		
		let instructor_entity = null;
		
		let hover = null;
		let fresh_hover = false;
		
		if ( sdWorld.server_config.new_player_delivery_hover && sdWorld.server_config.new_player_delivery_hover.hea > 0 )
		{
			hover = sdWorld.server_config.new_player_delivery_hover;
		}
		else
		{
		}
		
		
		// Spawn starter items based off what player wants to spawn with
		let guns = [ sdGun.CLASS_BUILD_TOOL, sdGun.CLASS_MEDIKIT, sdGun.CLASS_CABLE_TOOL, sdGun.CLASS_PISTOL ];
		
		if ( player_settings.start_with1 )
		guns.unshift( sdGun.CLASS_SWORD );
		else
		if ( player_settings.start_with2 )
		guns.unshift( sdGun.CLASS_SHOVEL );

		if ( character_entity.is( sdCharacter ) )
		for ( var i = 0; i < sdGun.classes.length; i++ )
		if ( guns.indexOf( i ) !== -1 )
		{
			let gun = new sdGun({ x:character_entity.x, y:character_entity.y, class: i });
			sdEntity.entities.push( gun );

			//if ( i !== sdGun.CLASS_BUILD_TOOL )
			//character_entity.gun_slot = sdGun.classes[ i ].slot;
		
			character_entity.onMovementInRange( gun );
		}
		
		character_entity.gun_slot = 1;
			
		// Track early damage and save this kind of info for later
		const EarlyDamageTaken = ( character_entity, dmg, initiator )=>
		{
			if ( dmg > 0 )
			if ( initiator )
			if ( initiator !== instructor_entity )
			if ( instructor_entity )
			if ( !instructor_entity._is_being_removed )
			{
				if ( instructor_entity._ai )
				instructor_entity._ai.target = initiator;
			}
			
			if ( character_entity.hea - dmg <= 30 )
			{
				/*sdWorld.no_respawn_areas.push({
					x: character_entity.x,
					y: character_entity.y,
					radius:150,
					until: sdWorld.time + 1000 * 60 // 1 minute at area
				});*/

				if ( initiator )
				{
					sdWorld.no_respawn_areas.push({
						x: character_entity.x,
						y: character_entity.y,
						entity: initiator,
						radius:250,
						until: sdWorld.time + 1000 * 60 * 5 // 5 minutes around entity that damaged
					});
				}
				
				sdWorld.server_config.SendNewPlayerDeliveryHoverAway();

				character_entity.removeEventListener( 'DAMAGE', EarlyDamageTaken );
			}
		};
		character_entity.addEventListener( 'DAMAGE', EarlyDamageTaken );
		
		// Disable starter damage tracking after while
		setTimeout( ()=>
		{
			character_entity.removeEventListener( 'DAMAGE', EarlyDamageTaken );
		}, 15000 );
		
		if ( !hover )
		if ( !sdWorld.server_config.skip_arrival_sequence )
		{
			fresh_hover = true;
			
			hover = new sdHover({ x:character_entity.x, y:character_entity.y });
			hover.guns = 0;
			hover._doors_locked = true;
			hover.nick = 'Extraction Hover';
			
			sdEntity.entities.push( hover );
			
			for ( let rise = 0; rise < 10; rise++ )
			{
				if ( hover.CanMoveWithoutOverlap( hover.x, hover.y - 16 ) )
				{
					hover.y -= 16;
				}
				else
				break;
			}
			
			{
				let pilot;
				pilot = new sdCharacter({ x:character_entity.x - 32, y:character_entity.y - 32 });
				pilot._ai_enabled = sdCharacter.AI_MODEL_NONE;

				//let pilot_settings = {"hero_name":"Extraction Pilot","color_bright":"#7aadff","color_dark":"#25668e","color_bright3":"#7aadff","color_dark3":"#25668e","color_visor":"#ffffff","color_suit":"#000000","color_shoes":"#303954","color_skin":"#51709a","voice1":true,"voice2":false,"voice3":false,"voice4":false,"voice5":false,"color_suit2":"#000000","color_dark2":"#25668e"};
				let pilot_settings = {"hero_name":"Extraction Pilot","color_bright":"#feeee1","color_dark":"#a38e7b","color_visor":"#58feb0","color_bright3":"#21180d","color_dark3":"#2d2824","color_suit":"#43382d","color_suit2":"#3c280b","color_dark2":"#000000","color_shoes":"#000000","color_skin":"#4c4224","color_extra1":"#000000","entity1":true,"entity2":false,"entity3":false,"entity4":false,"start_with1":true,"start_with2":false,"hints1":true,"hints2":false,"density1":true,"density2":false,"density3":false,"drone_helmet1":true,"drone_helmet2":false,"drone_helmet3":false,"drone_helmet4":false,"drone_helmet5":false,"drone_helmet6":false,"drone_helmet7":false,"drone_helmet8":false,"drone_helmet9":false,"drone_helmet10":false,"drone_helmet11":false,"drone_helmet12":false,"drone_helmet13":false,"drone_helmet14":false,"drone_helmet15":false,"drone_helmet16":false,"drone_helmet17":false,"drone_helmet18":false,"drone_helmet19":false,"drone_helmet20":false,"drone_helmet21":false,"drone_helmet22":false,"drone_helmet23":false,"drone_helmet24":false,"drone_helmet25":false,"drone_helmet26":false,"drone_helmet27":false,"drone_helmet28":false,"drone_helmet29":false,"drone_helmet30":false,"drone_helmet31":false,"drone_helmet32":false,"drone_helmet33":false,"drone_helmet34":false,"helmet28":false,"helmet47":false,"helmet88":false,"helmet13":false,"helmet32":false,"helmet29":false,"helmet97":false,"helmet98":false,"helmet79":false,"helmet87":false,"helmet18":false,"helmet48":false,"helmet25":false,"helmet99":false,"helmet106":false,"helmet49":false,"helmet100":false,"helmet101":false,"helmet71":false,"helmet50":false,"helmet33":false,"helmet102":false,"helmet34":false,"helmet94":false,"helmet51":false,"helmet96":false,"helmet9":false,"helmet11":false,"helmet7":false,"helmet52":false,"helmet53":false,"helmet4":false,"helmet31":false,"helmet54":false,"helmet103":false,"helmet95":false,"helmet35":false,"helmet3":false,"helmet2":false,"helmet115":false,"helmet116":false,"helmet55":false,"helmet36":false,"helmet22":false,"helmet8":false,"helmet20":false,"helmet37":false,"helmet56":false,"helmet15":false,"helmet57":false,"helmet27":false,"helmet58":false,"helmet38":false,"helmet91":false,"helmet39":false,"helmet59":false,"helmet60":false,"helmet83":false,"helmet104":false,"helmet77":false,"helmet26":false,"helmet40":false,"helmet6":false,"helmet78":false,"helmet61":false,"helmet76":false,"helmet89":false,"helmet84":false,"helmet12":false,"helmet19":true,"helmet17":false,"helmet41":false,"helmet42":false,"helmet105":false,"helmet43":false,"helmet70":false,"helmet85":false,"helmet23":false,"helmet10":false,"helmet14":false,"helmet92":false,"helmet68":false,"helmet16":false,"helmet62":false,"helmet69":false,"helmet81":false,"helmet75":false,"helmet72":false,"helmet107":false,"helmet108":false,"helmet45":false,"helmet80":false,"helmet1":false,"helmet63":false,"helmet109":false,"helmet64":false,"helmet44":false,"helmet110":false,"helmet90":false,"helmet65":false,"helmet73":false,"helmet30":false,"helmet111":false,"helmet113":false,"helmet112":false,"helmet5":false,"helmet21":false,"helmet24":false,"helmet86":false,"helmet74":false,"helmet93":false,"helmet114":false,"helmet46":false,"helmet66":false,"helmet67":false,"helmet82":false,"body62":false,"body8":false,"body17":false,"body16":false,"body52":false,"body69":false,"body70":false,"body53":false,"body61":false,"body46":false,"body13":false,"body71":false,"body72":false,"body73":false,"body42":false,"body18":false,"body74":false,"body19":false,"body67":false,"body32":false,"body68":false,"body75":false,"body33":false,"body20":false,"body60":false,"body87":false,"body21":false,"body10":false,"body22":false,"body2":false,"body15":false,"body5":false,"body34":false,"body6":false,"body23":true,"body55":false,"body24":false,"body35":false,"body58":false,"body76":false,"body50":false,"body14":false,"body25":false,"body51":false,"body48":false,"body63":false,"body26":false,"body47":false,"body27":false,"body28":false,"body41":false,"body36":false,"body11":false,"body65":false,"body39":false,"body7":false,"body40":false,"body56":false,"body37":false,"body43":false,"body77":false,"body78":false,"body29":false,"body54":false,"body1":false,"body79":false,"body80":false,"body30":false,"body49":false,"body81":false,"body64":false,"body3":false,"body4":false,"body82":false,"body83":false,"body44":false,"body9":false,"body12":false,"body59":false,"body45":false,"body66":false,"body84":false,"body85":false,"body31":false,"body86":false,"body57":false,"body38":false,"legs62":false,"legs8":false,"legs17":false,"legs16":false,"legs52":false,"legs69":false,"legs70":false,"legs53":false,"legs61":false,"legs46":false,"legs13":false,"legs71":false,"legs72":false,"legs73":false,"legs42":false,"legs18":false,"legs74":false,"legs19":false,"legs67":false,"legs32":false,"legs68":false,"legs75":false,"legs33":false,"legs20":false,"legs60":false,"legs87":false,"legs21":false,"legs10":false,"legs22":false,"legs2":false,"legs15":false,"legs5":false,"legs34":false,"legs6":false,"legs23":false,"legs55":false,"legs24":false,"legs35":false,"legs58":false,"legs76":false,"legs50":false,"legs14":false,"legs25":false,"legs51":false,"legs48":false,"legs63":false,"legs26":false,"legs47":false,"legs27":false,"legs28":false,"legs41":false,"legs36":false,"legs11":false,"legs65":false,"legs39":false,"legs7":false,"legs40":false,"legs56":false,"legs37":true,"legs43":false,"legs77":false,"legs78":false,"legs29":false,"legs54":false,"legs1":false,"legs79":false,"legs80":false,"legs30":false,"legs49":false,"legs81":false,"legs64":false,"legs3":false,"legs4":false,"legs82":false,"legs83":false,"legs44":false,"legs9":false,"legs12":false,"legs59":false,"legs45":false,"legs66":false,"legs84":false,"legs85":false,"legs31":false,"legs86":false,"legs57":false,"legs38":false,"bugs1":true,"bugs2":false,"voice1":true,"voice2":false,"voice3":false,"voice4":false,"voice5":false,"voice6":false,"voice7":false,"voice8":false,"voice9":false,"camera1":true,"camera2":false,"volume1":true,"volume2":false,"volume3":false,"censorship3":false,"censorship1":true,"censorship2":false}
				
				/*pilot.sd_filter = sdWorld.ConvertPlayerDescriptionToSDFilter_v2( pilot_settings );
				pilot._voice = sdWorld.ConvertPlayerDescriptionToVoice( pilot_settings );
				
				ConvertPlayerDescriptionToHelmet
				ConvertPlayerDescriptionToBody
				ConvertPlayerDescriptionToLegs*/
				
				sdWorld.ApplyPlayerSettingsToPlayer( pilot, pilot_settings, null );
				
				pilot.title = pilot_settings.hero_name;
				
				pilot.hmax = pilot.hea = 31;

				pilot.matter = 1;
				pilot.matter_max = 1;
				
				sdEntity.entities.push( pilot );
				
				hover.AddDriver( pilot, true );
			}
			
			sdWorld.server_config.new_player_delivery_hover = hover;
			
			setTimeout( ()=>
			{
				if ( sdWorld.server_config.new_player_delivery_hover === hover )
				sdWorld.server_config.SendNewPlayerDeliveryHoverAway();
				
			}, 1000 * 60 * 60 ); // Relocates in hour
		}
		
		// Instructor, obviously
		if ( player_settings.hints2 && character_entity.is( sdCharacter ) )
		{
			let intro_offset = 0;
			let intro_to_speak = [];

			switch ( ~~( Math.random() * 4 ) )
			{
				case 0: intro_to_speak.push( 'Welcome to Star Defenders!' ); break;
				case 1: intro_to_speak.push( 'Welcome to Star Defenders, [' + character_entity.title + ']!' ); break;
				case 2: intro_to_speak.push( 'Hi.' ); break;
				case 3: intro_to_speak.push( 'Hello.' ); break;
			}
			
			switch ( ~~( Math.random() * 16 ) ) // There should eventually be an sdContextMenu option for instructors and move the messages titled 'guides' there as options so players can learn about game mechanics and have the instructor mention that they can open ContextMenu on him to acccess the guides here instead along with basic quotes. - Ghost581
			{
				
				case 0: intro_to_speak.push( ...[
					'Everything wants to kill us here.',
					'You will probably not survive.',
					(~~(1 + Math.random() * 100)) + ' expeditors before you did not survive.',
					'If I was you I\'d go back to Mothership before it is too late.',
					'If you really want to try your luck however, I guess I could explain the basics to you along the way.',
				] ); break;
				
				case 1: intro_to_speak.push( ...[ // Basic introduction, edited to be more concise and relevant, though it would probably be better to divide some of this into other dialogs, too - floor
					'Use the W A S D keys to move around, or the arrow buttons.',
					'Move your mouse to aim, and press the Left Mouse button to attack.',
					'Sometimes you can use the Right Mouse button to interact with stuff, too.',
					'When you attack, you\'ll often use something called "Matter".',
					'"Matter" is used for practically everything!',
					'Including everything in the Building Menu, press B to access it now.',
					// 'or press the 9 key, and press right click.', 
					'Matter can be gained by killing and discovering things, or finding Crystals.',
					'Crystals can be found underground, so lets try digging for some!',
					'Try buying some weapons first though, those might help you fight, and dig better.',
					'...', // adding extra pauses in between so that instructor doesn't infodump on you
					'Every weapon and tool is assigned a slot number, press keys 0 from 9 to equip them.',
					'The Defibrillator can revive dead Players, recover health, and stop bleeding.',
					'Buying the ability upgrades can also come in handy.',
					'When you die, and respawn, you\'ll lose all of your stuff.',
					'So check your Tasks in the upper-left corner for important things.',
					'...',
					'Hold down the jump key to use the Jetpack, once you\'ve bought it.',
					'Press the C key, or click in your mouse wheel to use the Grappling Hook.',
					'You also can buy, and use Invisiblity with the E key, too',
					'Don\'t worry, I\'ll keep an eye on you.',
					'Just be sure to keep an eye on me, too? Sometimes I get stuck, and I don\'t have a Jetpack.',
					'Once you hit "Level 1", I\'ll consider your initiation course complete...',
					'then I\'ll head off to "instruct" the next guy we dragged into this mess.',
					'When I\'m gone though, try asking other Players here for help.',
					'Type out messages by pressing the Enter key. Press Enter again to send them.',
					'Sometimes they\'ll help you out a lot more than me.',
					'They won\'t hear you if you\'re too far away though.',
					'That\'s all the basics covered, let\'s get started!',
					// 'You can throw held items by pressing V key.', - covered in the game UI
					// 'You can aim at background-level walls by holding Shift key.', - not relevant to a new player
					// 'And finally, you can disable these hints at start screen.', - mention in other dialogs?
				] ); break;
				
				case 2: intro_to_speak.push( ...[  // Base building guide.
					'You will need a base to survive - put a Base Shielding Unit inside once you\'ve built the foundation.',
					'You can pick one out of three Base Shielding Unit types.',
					'The Green one consumes crystals and the Blue one uses matter.',
					'There is also a red one that uses your score. Don\'t forget to activate them!',
					'Also, put at least 3 big blocks for the walls.',
					'It will take more time for things to break through and anti-crystals won\'t drain your matter from outside.',
					'You also might want to put a Steering Wheel in order to prevent the base being moveable from outside.',
					'Also, get crystals and put them into Matter Amplifiers.',
					'You can make better artificial crystals by merging two of the same kind using a Crystal Combiner.',
					'Get score for doing tasks and discovering new things to unlock better Matter Amplifiers.',
					'Good luck with building a base!'
				] ); break;
				
				case 3: intro_to_speak.push( ...[  // Acid rain + instructor aggression guide ? edited by floor
					'...and so I tell the previous guy: "We\'re under the acid rain, let\'s hide underground!"',
					'And then he starts hitting me with his Shovel!',
					'So then after that, I killed him with my bare hands!',
					'Get it? I was operating purely off of my instincts, haha!',
					'...',
					'If you don\'t want me around, go to the menu...',
					'and set "Assign instructor on start" to "No", got it?',
					'...',
					'Oh, and don\'t attack me.',
					'I\'ll also go away when you hit "Level 1" anyways, so get to it!'
				] ); break;
				
				case 4: intro_to_speak.push( ...[ // Underground spawn/basing guide ?
					'You will die here unless you know what you\'re doing.',
					'You should hide underground and establish a base, be aware of the dangers that lurk in the depths though.',
				] ); break;
				
				case 5: intro_to_speak.push( ...[  // Rescue Teleport guide.
					'Be smarter than dozen of previous guys and build a Rescue Teleporter.',
					'We also call them RTPs.',
					'They save you from death, but they won\'t save you from being crystallized by Cubes.',
					'You have to connect them to Matter Amplifiers so they can charge.',
					'Don\'t use them too much in a short time period though, they can overheat!',
					'Good luck!'
				] ); break;
				
				case 6: intro_to_speak.push( ...[  // Communication Node guide
					'You probably don\'t want strangers or creatures inside your base.',
					'Once you have built your base foundation and installed a Base Shielding Unit,',
					'add some Doors and connect them with a Cable Management Tool to Communication Nodes to enable them.',
					'It will prevent unwanted guests from entering your base.',
					'Communication Nodes manage what can open Doors and what Turrets target.',
					'Communication Nodes are also needed for some Base Equipment to work.',
					'For example, you will need to attach a cable to a Matter Amplifier to charge Turrets connected to the Comm Node.',
					'You can subscribe to Comm Nodes by Right Clicking them, the owners are automatically subscribed.',
					'We also call them Comms or Comm Nodes.',
					'You can extend the range of Comm Nodes by connecting them to Nodes.',
					'That\'s all I know about Communication Nodes.'
				] ); break;
				
				case 7: intro_to_speak.push( ...[ // Command Centre and teams guide
					'You should meet up with your friends if you have any around here, it\'ll be easier to survive.',
					'You should build a Command Centre and accept their team join requests.',
					'If they\'re not on your task team you can hurt them. Watch out for friendly fire!',
					'Command Centres are also used to receive tasks from the Mothership.',
					'It is worth to do tasks as you will be able to claim rewards once you\'ve done enough of them.',
					'These rewards will be useful to help you survive and deal with threats.',
					'We also call them CCs.',
					'That is all I know about Command Centres.',
					'Good luck!'
				] ); break;
				
				case 8: intro_to_speak.push( ...[ // Long Range Teleporter guide
					'You should build a Long Range Teleporter when you\'ve established a base.',
					'Connect them to a Communication Node which is connected to a Matter Amplifier to charge it.',
					'You will also need to connect it to a Command Centre.',
					'Long Range Teleporters are used to complete various tasks issued by the Mothership.',
					'You can receive tasks from interacting with Command Centres, and earn rewards from them.',
					'You should build them somewhere safe as creatures and aliens will try to destroy them.',
					'We also call them LRTPs.',
					'Though don\'t confuse the red ones with the blue ones; They teleport you somewhere else off-planet.',
					'On the other side you can usually just teleport back, though beware,',
					'you will have to build new Rescue Teleporters on the other side as they only have local planetary range.',
					'That is all I know about Long Range Teleporters.'
				] ); break;

				case 9: intro_to_speak.push( ...[  // Octopus guide
					'Octopuses are tough and can eat your weapons and tools if you\'re close.',
					'A grenade launcher\'s bouncy explosives can kill them while you\'re hiding behind a wall.',
					'You can also take them out safely if you\'re outside their range with snipers.',
					'Though it\'s harder to do unless you have the high ground, they like getting close to you.'
				] ); break;
				
				case 10: intro_to_speak.push( ...[  // Crystal Crabs guide
					'Crystal crabs can eat plants to recover their regeneration rate.',
					'You should watch out for the big ones, if you hurt them, they will try to eat you instead.'
				] ); break;
				
				case 11: intro_to_speak.push( ...[  // Cube faction guides
					'Watch out for Cubes, they protect this land and are dangerous if you anger them.',
					'They are very protective about crystals, so try to not break them.',
					'The Cubes don\'t seem to mind us taking matter they store however, so don\'t worry about that.'
				] ); break;
				
				case 12: intro_to_speak.push( ...[  // Alien factions guide
					'Some creatures really want our matter.',
					'You should watch out for alien lifeforms, since most will try to attack you.'
				] ); break;
				
				case 13: intro_to_speak.push( ...[  // Levelling up guide
					'Score is needed to level up. You gain it from defeating enemies, discovering new things and completing tasks.',
					'When you have enough score you level up and unlock new things to build.',
					'You will also unlock new upgrades and equipment. Your matter capacity can increase up to 1850 by gaining score.',
					'You will need Cube Shards to increase your matter capacity past 1850 once you\'ve reached the threshold.',
					'Good luck!'
				] ); break;

				case 14: intro_to_speak.push( ...[  // Friendly fire by floor
					'Sorry If I shot you in your past life.',
					'My aim isn\'t the best, that\'s why I took this job.',
					'I also get pretty scared when people shoot at me.',
					'So I return the favor, and then some! Haha!',
					'Sometimes other Star Defenders will do that, too.',
					'If you shoot them, they shoot back.',
					'Sometimes they kill you over a small wound, and sometimes they don\'t do that.',
					'...',
					'I mean, sometimes they \*will* just kill you for no reason.',
					'But don\'t worry about that.',
					'Just remember to have fun, okay?'
				] ); break;

				case 15: intro_to_speak.push( ...[  // Drone guide by floor
					'You know you how to operate a Drone, right?',
					'In the menu, you have the option to "Play as" a Humanoid, a Drone, or an Overlord.',
					'Drones can\'t use a Build Tool, but they\'re pretty good at mining.',
					'Drones can also Right Click and hold to telekinetically grab Crystals, and other objects.',
					'They can also pick up Crates, Players -- and even Monsters, too.',
					'If a Drone gets to Level 1, they get a few more tools as well.',
					'Slot 2 is a Mining Beam, 4 is a Power Beam, and 5 is a Self-Destruct.',
					'They also have a Cable Tool in Slot 7 too, but you don\'t need Level 1 for that one.',
					'Drones can be awfully helpful to us Star Defenders.',
					'...',
					'Oh, and they can also press and hold V to give their own matter to Players and Objects.',
					'Cool, huh?',
				] ); break;
			}
				
			let my_character_entity = character_entity;
			
			
			
			instructor_entity = new sdCharacter({ x:my_character_entity.x + 32, y:my_character_entity.y - 32 });
			instructor_entity._ai_enabled = sdCharacter.AI_MODEL_TEAMMATE;//sdCharacter.AI_MODEL_INSTRUCTOR;
			instructor_entity._ai_gun_slot = sdGun.classes[ sdGun.CLASS_RAILGUN ].slot;
			instructor_entity._allow_despawn = false;
			instructor_entity._ai_level = 10;
			instructor_entity._matter_regeneration = 1;
			instructor_entity._matter_regeneration_multiplier = 10;
			
			let instructor_gun = new sdGun({ x:instructor_entity.x, y:instructor_entity.y, class:sdGun.CLASS_RAILGUN });
			
			instructor_entity.onMovementInRange( instructor_gun );
			
			let instructor_settings = {"hero_name":"Instructor","color_bright":"#7aadff","color_dark":"#25668e","color_bright3":"#7aadff","color_dark3":"#25668e","color_visor":"#ffffff","color_suit":"#000000","color_shoes":"#303954","color_skin":"#51709a","voice1":true,"voice2":false,"voice3":false,"voice4":false,"voice5":false,"color_suit2":"#000000","color_dark2":"#25668e"};

			instructor_entity.sd_filter = sdWorld.ConvertPlayerDescriptionToSDFilter_v2( instructor_settings );
			instructor_entity._voice = sdWorld.ConvertPlayerDescriptionToVoice( instructor_settings );
			instructor_entity.title = instructor_settings.hero_name;
			//instructor_entity.matter = 1;
			instructor_entity.matter_max = 1;
			let instructor_interval0 = setInterval( ()=>
			{
				if ( instructor_entity.hea <= 0 || instructor_entity._is_being_removed )
				instructor_gun.remove();
				
				if ( my_character_entity._is_being_removed || 
					 instructor_entity._is_being_removed || 
					 my_character_entity._socket === null || 
					 ( instructor_entity.hea <= 0 && sdWorld.Dist2D( instructor_entity.x, instructor_entity.y, my_character_entity.x, my_character_entity.y ) > 800 ) )
				{
					instructor_gun.remove();
					instructor_entity.remove();
					clearInterval( instructor_interval0 );
					return;
				}
				
				//instructor_entity.gun_slot = sdGun.classes[ sdGun.CLASS_RAILGUN ].slot;
				
				instructor_entity._key_states.SetKey( 'KeyA', 0 );
				instructor_entity._key_states.SetKey( 'KeyD', 0 );
				instructor_entity._key_states.SetKey( 'KeyW', 0 );
				
				if ( instructor_entity.x < my_character_entity.x - 32 )
				instructor_entity._key_states.SetKey( 'KeyD', 1 );
			
				if ( instructor_entity.x > my_character_entity.x + 32 )
				instructor_entity._key_states.SetKey( 'KeyA', 1 );
			
				if ( my_character_entity.stands )
				if ( instructor_entity.y > my_character_entity.y + 8 )
				instructor_entity._key_states.SetKey( 'KeyW', 1 );
			
				/*if ( instructor_entity._ai && instructor_entity._ai.target )
				{
				}
				else
				{
					instructor_entity.look_x = my_character_entity.x;
					instructor_entity.look_y = my_character_entity.y;
				}*/
		
				instructor_entity.SetHiberState( sdEntity.HIBERSTATE_ACTIVE );
				
			}, 100 );
			let instructor_interval = setInterval( ()=>
			{
				if ( instructor_entity && instructor_entity.hea > 0 && !instructor_entity._is_being_removed && !instructor_entity.driver_of )
				{
					/*if ( my_character_entity.hea > 0 && !my_character_entity._dying )
					if ( sdWeather.only_instance )
					if ( sdWeather.only_instance.raining_intensity > 0 )
					if ( sdWeather.only_instance._rain_amount > 0 )
					if ( sdWeather.only_instance.TraceDamagePossibleHere( my_character_entity.x, my_character_entity.y ) )
					{
						if ( my_character_entity.matter > 5 )
						instructor_entity.Say( 'Looks like we are under the acid rain, try to find shelter or dig under the ground to hide from it.', false );
						else
						instructor_entity.Say( 'Looks like we are under the acid rain, try to find shelter or water.', false );
					
						return;
					}*/

					if ( intro_to_speak[ intro_offset ] )
					{
						instructor_entity.Say( intro_to_speak[ intro_offset ], false );
					}
					intro_offset++;
				}
				
				if ( !instructor_entity._ai || !instructor_entity._ai.target || instructor_entity._ai.target._is_being_removed )
				if ( /*intro_offset > intro_to_speak.length*/ my_character_entity.build_tool_level > 0 || instructor_entity._is_being_removed )
				{
					clearInterval( instructor_interval );
					
					sdWorld.SendEffect({ x:instructor_entity.x + (instructor_entity.hitbox_x1+instructor_entity.hitbox_x2)/2, y:instructor_entity.y + (instructor_entity.hitbox_y1+instructor_entity.hitbox_y2)/2, type:sdEffect.TYPE_TELEPORT });
					
					sdSound.PlaySound({ name:'teleport', x:instructor_entity.x, y:instructor_entity.y, volume:0.5 });
						
					instructor_entity.remove();
				}
				
			}, 5500 );
			
			
			sdEntity.entities.push( instructor_entity );
			sdEntity.entities.push( instructor_gun );
			
			if ( Math.random() < 0.25 )
			{
				let instructor_gun2 = new sdGun({ x:instructor_entity.x, y:instructor_entity.y, class:sdGun.CLASS_EMERGENCY_INSTRUCTOR });
				sdEntity.entities.push( instructor_gun2 );
				
				instructor_entity.onMovementInRange( instructor_gun2 );
			}
		}
		
		if ( hover )
		{
			hover.AddDriver( character_entity, true );

			if ( instructor_entity )
			hover.AddDriver( instructor_entity, true );

			setTimeout( ()=>
			{
				if ( character_entity.driver_of )
				character_entity.driver_of.ExcludeDriver( character_entity, true );
	
	
				setTimeout( ()=>
				{
					if ( instructor_entity )
					if ( !instructor_entity._is_being_removed )
					if ( instructor_entity.driver_of )
					instructor_entity.driver_of.ExcludeDriver( instructor_entity, true );
		
				}, 2500 );

			}, fresh_hover ? 5000 : 1000 );
		}
		
	}
	static EntitySaveAllowedTest( entity )
	{
		// This method should return false in cases when specific entities should never be saved in snapshots (for example during reboot). Can be used to not save players for FFA servers especially if reboots are frequent
			
		return true;
	}
	static onBeforeSnapshotLoad()
	{
		// Do something before shapshot is loaded. It is earliest available stage of logic - you can edit or alter shop contents here
			
		sdWorld.no_respawn_areas = [];
	}
	static onAfterSnapshotLoad()
	{
		// World exists and players are ready to connect
		
		// In case of new server these will be 0. This will define initial world bounds:
		if ( sdWorld.world_bounds.x1 === 0 )
		if ( sdWorld.world_bounds.x2 === 0 )
		if ( sdWorld.world_bounds.y1 === 0 )
		if ( sdWorld.world_bounds.y2 === 0 )
		{
			console.log( 'Reinitializing world bounds' );
			
			if ( sdWorld.server_config.aggressive_hibernation )
			{
				sdWorld.ChangeWorldBounds( -16 * Math.round( sdDeepSleep.normal_cell_size / 16 ), -16 * Math.round( sdDeepSleep.normal_cell_size / 16 ), 16 * Math.round( sdDeepSleep.normal_cell_size / 16 ), 16 * Math.round( sdDeepSleep.normal_cell_size / 16 ) );
			}
			else
			sdWorld.ChangeWorldBounds( -16 * Math.round( 4000 / 16 ), -16 * Math.round( 2000 / 16 ), 16 * Math.round( 4000 / 16 ), 16 * Math.round( 2000 / 16 ) );
		}
			
		const world_edge_think_rate = 500;
			
		// Setup a logic for world bounds shifter
		setInterval( ()=>
		{
			if ( !sdWorld.server_config.enable_bounds_move )
			return;
		
			let x1 = sdWorld.world_bounds.x1;
			let y1 = sdWorld.world_bounds.y1;
			let x2 = sdWorld.world_bounds.x2;
			let y2 = sdWorld.world_bounds.y2;
			
			if ( sdWorld.server_config.aggressive_hibernation )
			{
				// New approach, allows infinite world stretching, aggrassive hiberantion will handle proper freezing of chunks
				
				const increase_step_size = sdDeepSleep.normal_cell_size;
				
				x1 = Math.floor( x1 / sdDeepSleep.normal_cell_size ) * sdDeepSleep.normal_cell_size;
				x2 = Math.ceil( x2 / sdDeepSleep.normal_cell_size ) * sdDeepSleep.normal_cell_size;
				y1 = Math.floor( y1 / sdDeepSleep.normal_cell_size ) * sdDeepSleep.normal_cell_size;
				y2 = Math.ceil( y2 / sdDeepSleep.normal_cell_size ) * sdDeepSleep.normal_cell_size;
				
				let left = 0;
				let right = 0;
				let up = 0;
				let down = 0;
				
				const distance_near_edge_to_trigger = 256;
				
				for ( let i = 0; i < sockets.length; i++ )
				{
					let ent = sockets[ i ].character;
					if ( ent !== null )
					if ( ent.hea > 0 )
					if ( !ent._is_being_removed )
					{
						if ( ent.x < x1 + distance_near_edge_to_trigger )
						left = increase_step_size;
						if ( ent.x > x2 - distance_near_edge_to_trigger )
						right = increase_step_size;
						
						if ( ent.y < y1 + distance_near_edge_to_trigger )
						up = increase_step_size;
						if ( ent.y > y2 - distance_near_edge_to_trigger )
						down = increase_step_size;
					}
				}
				
				if ( up || down || left || right )
				sdWorld.ChangeWorldBounds( x1 - left, y1 - up, x2 + right, y2 + down );
			}
			else
			{
				// Classic bounds move approach
				
				// Locked decrease for removal of old parts
				let x1_locked = false;
				let y1_locked = false;
				let x2_locked = false;
				let y2_locked = false;

				let x1_locked_by = [];
				let y1_locked_by = [];
				let x2_locked_by = [];
				let y2_locked_by = [];

				let edge_cursious = []; // -1
				let edge_cursious_ent = [];

				let sockets = sdWorld.sockets;
				let no_respawn_areas = sdWorld.no_respawn_areas;

				function TellReason()
				{
					for ( var i = 0; i < edge_cursious_ent.length; i++ )
					{
						if ( edge_cursious_ent[ i ]._socket )
						{
							let blocking_by = [];

							switch ( edge_cursious[ i ] )
							{
								case 0: for ( var i2 = 0; i2 < x1_locked_by.length; i2++ ) blocking_by.push( sdEntity.GuessEntityName( x1_locked_by[ i2 ]._net_id ) ); break;
								case 1: for ( var i2 = 0; i2 < x2_locked_by.length; i2++ ) blocking_by.push( sdEntity.GuessEntityName( x2_locked_by[ i2 ]._net_id ) ); break;
								case 2: for ( var i2 = 0; i2 < y1_locked_by.length; i2++ ) blocking_by.push( sdEntity.GuessEntityName( y1_locked_by[ i2 ]._net_id ) ); break;
								case 3: for ( var i2 = 0; i2 < y2_locked_by.length; i2++ ) blocking_by.push( sdEntity.GuessEntityName( y2_locked_by[ i2 ]._net_id ) ); break;
							}

							for ( var i2 = 0; i2 < blocking_by.length; i2++ )
							{
								let count = 1;
								for ( var i3 = i2 + 1; i3 < blocking_by.length; i3++ )
								{
									if ( blocking_by[ i2 ] === blocking_by[ i3 ] )
									{
										count++;
										blocking_by.splice( i3, 1 );
										i3--;
										continue;
									}
								}
								if ( count > 1 )
								{
									blocking_by[ i2 ] = blocking_by[ i2 ] + ' x' + count;
								}
							}

							if ( blocking_by.length === 1 )
							edge_cursious_ent[ i ]._socket.SDServiceMessage( 'World can not be extended past this point - ' + blocking_by.join(', ') + ' is at the opposite edge of playable area' );
							else
							edge_cursious_ent[ i ]._socket.SDServiceMessage( 'World can not be extended past this point - ' + blocking_by.join(', ') + ' are at the opposite edge of playable area' );
						}
					}
				}

				let top_matter = 0;


				for ( let i = 0; i < no_respawn_areas.length; i++ )
				{
					if ( sdWorld.time > no_respawn_areas[ i ].until )
					{
						no_respawn_areas.splice( i, 1 );
						i--;
						continue;
					}

					if ( no_respawn_areas[ i ].entity )
					{
						if ( no_respawn_areas[ i ].entity._is_being_removed )
						{
							no_respawn_areas.splice( i, 1 );
							i--;
							continue;
						}

						no_respawn_areas[ i ].x = no_respawn_areas[ i ].entity.x;
						no_respawn_areas[ i ].y = no_respawn_areas[ i ].entity.y;
					}
				}

				for ( let i = 0; i < sockets.length; i++ )
				{
					var ent = sockets[ i ].character;
					if ( ent !== null )
					if ( ent.hea > 0 )
					if ( !ent._is_being_removed )
					{
						if ( ent.matter > top_matter )
						top_matter = ent.matter;

						if ( sdWorld.world_bounds.x2 - sdWorld.world_bounds.x1 > 4000 )
						{
							if ( ent.x < sdWorld.world_bounds.x1 + 2000 )
							{
								x1_locked = true;
								x1_locked_by.push( ent );
							}

							if ( ent.x > sdWorld.world_bounds.x2 - 2000 )
							{
								x2_locked = true;
								x2_locked_by.push( ent );
							}
						}


						if ( sdWorld.world_bounds.y2 - sdWorld.world_bounds.y1 > 2000 )
						{
							if ( ent.y < sdWorld.world_bounds.y1 + 1000 )
							{
								y1_locked = true;
								y1_locked_by.push( ent );
							}

							if ( ent.y > sdWorld.world_bounds.y2 - 1000 )
							{
								y2_locked = true;
								y2_locked_by.push( ent );
							}
						}
						/*
						if ( ent.y < ( sdWorld.world_bounds.y1 + sdWorld.world_bounds.y2 ) / 2 )
						y1_locked = true;
						else
						y2_locked = true;*/

						if ( ent.x > sdWorld.world_bounds.x2 - 16 * 40 )
						{
							x2 += 16 * 5;

							if ( ent.x > sdWorld.world_bounds.x2 - 32 )
							{
								edge_cursious.push( 0 );
								edge_cursious_ent.push( ent );
							}
						}

						if ( ent.x < sdWorld.world_bounds.x1 + 16 * 40 )
						{
							x1 -= 16 * 5;
							if ( ent.x < sdWorld.world_bounds.x1 + 32 )
							{
								edge_cursious.push( 1 );
								edge_cursious_ent.push( ent );
							}
						}

						if ( ent.y > sdWorld.world_bounds.y2 - 16 * 40 )
						{
							y2 += 16 * 5;
							if ( ent.y > sdWorld.world_bounds.y2 - 32 )
							{
								edge_cursious.push( 2 );
								edge_cursious_ent.push( ent );
							}
						}

						if ( ent.y < sdWorld.world_bounds.y1 + 16 * 40 )
						{
							y1 -= 16 * 5;
							if ( ent.y < sdWorld.world_bounds.y1 + 32 )
							{
								edge_cursious.push( 3 );
								edge_cursious_ent.push( ent );
							}
						}
					}
				}

				for ( let i = 0; i < sdCommandCentre.centres.length; i++ )
				{
					var ent = sdCommandCentre.centres[ i ];

					if ( top_matter >= sdCharacter.matter_required_to_destroy_command_center )
					if ( ent.self_destruct_on < sdWorld.time + sdCommandCentre.time_to_live_without_matter_keepers_near - 1000 * 5 )
					{
						ent.self_destruct_on = Math.min( ent.self_destruct_on + world_edge_think_rate * 2, sdWorld.time + sdCommandCentre.time_to_live_without_matter_keepers_near );
					}

					if ( ent.x < sdWorld.world_bounds.x1 + 1000 )
					{
						x1_locked = true;
						x1_locked_by.push( ent );
					}
					if ( ent.x > sdWorld.world_bounds.x2 - 1000 )
					{
						x2_locked = true;
						x2_locked_by.push( ent );
					}

					if ( ent.y < sdWorld.world_bounds.y1 + 1000 )
					{
						y1_locked = true;
						y1_locked_by.push( ent );
					}
					if ( ent.y > sdWorld.world_bounds.y2 - 1000 )
					{
						y2_locked = true;
						y2_locked_by.push( ent );
					}
				}

				if ( sdWorld.world_bounds.x1 !== x1 ||
					 sdWorld.world_bounds.y1 !== y1 ||
					 sdWorld.world_bounds.x2 !== x2 ||
					 sdWorld.world_bounds.y2 !== y2 )
				{
					let min_width = 3200 * 2; // % 16
					let min_height = 1600 * 2; // % 16

					if ( x2 - x1 > min_width )
					{
						if ( x1_locked && x2_locked )
						{
							x1 = sdWorld.world_bounds.x1;
							x2 = sdWorld.world_bounds.x2;
							//return; 
						}
						else
						{
							if ( x1_locked )
							x2 = x1 + min_width;
							else
							x1 = x2 - min_width;
						}
					}

					if ( y2 - y1 > min_height )
					{
						if ( y1_locked && y2_locked )
						{
							y1 = sdWorld.world_bounds.y1;
							y2 = sdWorld.world_bounds.y2;
							//return;
						}
						else
						{
							if ( y1_locked )
							y2 = y1 + min_height;
							else
							y1 = y2 - min_height;
						}
					}

					if ( sdWorld.world_bounds.x1 !== x1 ||
						 sdWorld.world_bounds.y1 !== y1 ||
						 sdWorld.world_bounds.x2 !== x2 ||
						 sdWorld.world_bounds.y2 !== y2 )
					sdWorld.ChangeWorldBounds( x1, y1, x2, y2 );
					else
					TellReason();
				}
				else
				{
					TellReason();
				}
			}

		}, world_edge_think_rate );
	}
	static PlayerSpawnPointSeeker( character_entity, socket )
	{
		// This method wakes up sdDeepSleep areas beacause all of them might be hibernated. It should damage perfrormance in long term, paying attention to player spawn lags needs to be done
		
		//const sdBaseShieldingUnit = sdWorld.entity_classes.sdBaseShieldingUnit;
		//const sdBlock = sdWorld.entity_classes.sdBlock;
		
		let x1 = Math.max( sdWorld.world_bounds.x1, -sdWorld.server_config.open_world_max_distance_from_zero_coordinates_x );
		let x2 = Math.min( sdWorld.world_bounds.x2, sdWorld.server_config.open_world_max_distance_from_zero_coordinates_x );
		
		let y1 = Math.max( sdWorld.world_bounds.y1, sdWorld.server_config.open_world_max_distance_from_zero_coordinates_y_min );
		let y2 = Math.min( sdWorld.world_bounds.y2, sdWorld.server_config.open_world_max_distance_from_zero_coordinates_y_max );
		
		/*sdWorld.server_config.open_world_max_distance_from_zero_coordinates_x
		sdWorld.server_config.open_world_max_distance_from_zero_coordinates_y_min
		sdWorld.server_config.open_world_max_distance_from_zero_coordinates_y_max*/
		
		// Limit by zero coords somewhat
		x1 = Math.max( x1, -10000 );
		x2 = Math.min( x2, 10000 );
		y1 = Math.max( y1, -1000 );
		y2 = Math.min( y2, 1000 );
		
		let x,y,bad_areas_near,i;
		let tr = 0;
		let max_tr = 10000;
		do
		{
			x = x1 + Math.random() * ( x2 - x1 );
			y = y1 + Math.random() * ( y2 - y1 );

			if ( socket.command_centre )
			{
				if ( socket.command_centre._is_being_removed )
				{
					socket.command_centre = null;
					socket.SDServiceMessage( 'Command Centre no longer exists' );
				}
				else
				{
					if ( tr < max_tr * 0.05 )
					{
						x = socket.command_centre.x - 100 + Math.random() * 200;
						y = socket.command_centre.y - 100 + Math.random() * 200;
					}
					else
					if ( tr < max_tr * 0.1 )
					{
						x = socket.command_centre.x - 500 + Math.random() * 1000;
						y = socket.command_centre.y - 500 + Math.random() * 1000;
					}
					else
					if ( tr < max_tr * 0.15 )
					{
						x = socket.command_centre.x - 500 + Math.random() * 1000;
						y = socket.command_centre.y - 500 + Math.random() * 1000;
					}
				}
			}

			bad_areas_near = 0;

			for ( i = 0; i < sdWorld.no_respawn_areas.length; i++ )
			if ( sdWorld.inDist2D_Boolean( x, y, sdWorld.no_respawn_areas[ i ].x, sdWorld.no_respawn_areas[ i ].y, sdWorld.no_respawn_areas[ i ].radius ) )
			{
				bad_areas_near++;
				break;
			}
			
			let bsu_nearby = false;
			for ( let i = 0; i < sdBaseShieldingUnit.all_shield_units.length; i++ )
			{
				let e = sdBaseShieldingUnit.all_shield_units[ i ];
				if ( e.enabled )
				if ( sdWorld.inDist2D_Boolean( x, y, e.x, e.y, sdBaseShieldingUnit.protect_distance ) )
				{
					bsu_nearby = true;
					break;
				}
			}
			
			sdWorld.last_hit_entity = null;

			// It is good for hover-less version:
			//let can_stand_here = character_entity.CanMoveWithoutOverlap( x, y, 0 ) && !character_entity.CanMoveWithoutOverlap( x, y + 32, 0 );
			let can_stand_here = ( 
				!sdWorld.CheckWallExistsBox( 
					x + (-26), 
					y + (-9), 
					x + (26), 
					y + (10), character_entity, character_entity.GetIgnoredEntityClasses(), character_entity.GetNonIgnoredEntityClasses(), null )
				&& 
				sdWorld.CheckWallExistsBox( 
					x + (-26), 
					y + (-9) + 19, 
					x + (26), 
					y + (10) + 19, character_entity, character_entity.GetIgnoredEntityClasses(), character_entity.GetNonIgnoredEntityClasses(), null ) 
			);
			
			let ground_ent = sdWorld.last_hit_entity;
			
			// Note: socket.command_centre is no longer used (CC no longer goes there)


			if ( !bsu_nearby )
			// Dedicated first 60% of attempts to spawn somewhere where there is no early damage
			if ( tr > max_tr * 0.6 || bad_areas_near === 0 )
			// Dedicated first 80% of attempts to spawn somewhere where can stand and there is no water
			if ( tr > max_tr * 0.8 || ( can_stand_here && !sdWorld.CheckWallExistsBox( 
					x + character_entity._hitbox_x1 - 16, 
					y + character_entity._hitbox_y1 - 16, 
					x + character_entity._hitbox_x2 + 16, 
					y + character_entity._hitbox_y2 + 16, null, null, [ 'sdWater' ], null ) ) )
			// Dedicated first 40% of attempts to spawn somewhere where ground exists
			if ( tr > max_tr * 0.4 || 
				 socket.command_centre || 
				 ( ground_ent !== null && 
					( ground_ent.is( sdBlock ) && 
						( 
							ground_ent.DoesRegenerateButDoesntDamage() )
					) 
				) 
			) // Only spawn on ground (or near CC)
			{
				character_entity.x = x;
				character_entity.y = y;

				//sdWorld.UpdateHashPosition( ent, false );

				if ( socket.command_centre )
				{
					if ( Math.abs( socket.command_centre.x - x ) <= 200 && Math.abs( socket.command_centre.y - y ) <= 200 )
					{
						socket.respawn_block_until = sdWorld.time + 1000 * 10; // Not too frequently
					}
					else
					if ( Math.abs( socket.command_centre.x - x ) <= 500 && Math.abs( socket.command_centre.y - y ) <= 500 )
					{
						socket.respawn_block_until = sdWorld.time + 1000 * 10; // Not too frequently

						socket.SDServiceMessage( 'Unable to respawn too close to Command Centre (possibly due to recent spawnkills near Command Center)' );
					}
					else
					socket.SDServiceMessage( 'Unable to respawn near Command Centre (possibly due to recent spawnkills near Command Center)' );
				}

				break;
			}

			tr++;
			if ( tr > max_tr )
			{
				character_entity.x = x;
				character_entity.y = y;
				break;
			}
		} while( true );
	}
};

export { sdServerConfigShort, sdServerConfigFull };
