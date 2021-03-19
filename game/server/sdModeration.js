
/* global process, globalThis */
/*

	TODO: Recursively demote all admins that were promoted by demoted admin.

*/

import fs from 'fs';
//import fs from 'fs-extra';

import sdWorld from '../sdWorld.js';

import { spawn } from 'child_process';

class sdModeration
{
	static init_class()
	{
		// JSON it to save
		sdModeration.data = {
			admins: [
				// { my_hash, access_level, pseudonym, promoter_hash } // lower access_level - more rights // promoter_hash can be null for first admin
			],
			ban_ips: {},
			ban_passwords: {}
			// xxx: { until, reason, pseudonym, time } // not working yet
		};
		sdModeration.ever_loaded = false;
		
		sdModeration.non_admin_commands = [ 'myid', 'id', 'help', '?', 'commands', 'listadmins', 'selfpromote', 'connection', 'kill' ];
		
		sdModeration.Load();
	}
	
	static Save()
	{
		fs.writeFile( sdWorld.moderation_data_path_const, JSON.stringify( sdModeration.data ), ( err )=>{});
	}
	
	static Load( timeout=5000 )
	{
		try
		{
			if ( globalThis.file_exists( sdWorld.moderation_data_path_const ) )
			{
				let potential = JSON.parse( fs.readFileSync( sdWorld.moderation_data_path_const ) );
				
				if ( typeof potential === 'object' && typeof potential.admins === 'object' && typeof potential.ban_ips === 'object' && typeof potential.ban_passwords === 'object' )
				sdModeration.data = potential;
				else
				throw new Error('Bad JSON object property types');
			}
			else
			sdModeration.Save();
			
			sdModeration.ever_loaded = true;
		}
		catch( e )
		{
			debugger;
			
			setTimeout( ()=>
			{
				for ( let i = 0; i < sdWorld.sockets.length; i++ )
				sdWorld.sockets[ i ].emit('SERVICE_MESSAGE', 'Server: Moderation has been disabled due to access file read error. Type /retry to try again.' );
			
			}, timeout );
		}
	}
	
	static CommandReceived( socket, text )
	{
		text = text.substring( 1 ); // Skip /
		
		var parts = text.split(' ');
		
		if ( !sdModeration.ever_loaded )
		if ( parts[ 0 ] !== 'retry' )
		{
			socket.emit('SERVICE_MESSAGE', 'Server: Moderation has been disabled due to access file read error. Type /retry to try again.' );
			return;
		}
	
		if ( socket.my_hash === null )
		{
			socket.emit('SERVICE_MESSAGE', 'Server: No permissions for unknown user.' );
			return;
		}
	
		let my_admin_row = null;
		
		let is_non_admin = false;
		
		for ( var a = 0; a < sdModeration.data.admins.length; a++ )
		{
			if ( sdModeration.data.admins[ a ].my_hash === socket.my_hash )
			{
				my_admin_row = sdModeration.data.admins[ a ];
				break;
			}
		}
		
		if ( !my_admin_row )
		{
			is_non_admin = ( sdModeration.non_admin_commands.indexOf( parts[ 0 ] ) !== -1 );
			
			if ( sdModeration.ever_loaded )
			if ( !is_non_admin )
			{
				socket.emit('SERVICE_MESSAGE', 'Server: No permissions.' );
				return;
			}
		}
		else
		{
			is_non_admin = false;
		}
		
		if ( parts[ 0 ] === 'selfpromote' )
		{
			if ( sdModeration.data.admins.length === 0 )
			{
				if ( socket.my_hash && socket.character )
				{
					if ( !globalThis.file_exists( sdWorld.superuser_pass_path ) )
					{
						fs.writeFileSync( sdWorld.superuser_pass_path, 'pass'+ ~~( 100 + Math.random() * 899 ) );
					}
					
					let pass = fs.readFileSync( sdWorld.superuser_pass_path ).toString();
					
					if ( pass && pass === parts[ 1 ] )
					{
						sdModeration.data.admins.push( { my_hash: socket.my_hash, access_level: 0, pseudonym: socket.character.title, promoter_hash: null } );
						sdModeration.Save();
						socket.emit('SERVICE_MESSAGE', 'Server: You are a first admin now! That password won\'t work while at least one admin exists.' );
					}
					else
					socket.emit('SERVICE_MESSAGE', 'Server: Wrong password. Check superuser_pass.v for correct one.' );
				}
				else
				socket.emit('SERVICE_MESSAGE', 'Server: No hash or no character found.' );
			}
			else
			socket.emit('SERVICE_MESSAGE', 'Server: First admin already exists.' );
		}
		else
		if ( parts[ 0 ] === 'retry' )
		{
			sdModeration.Load( 0 );
		}
		else
		if ( parts[ 0 ] === 'myid' || parts[ 0 ] === 'id' )
		{
			if ( socket.character )
			socket.character.Say( 'My _net_id is ' + socket.character._net_id );
		}
		else
		if ( parts[ 0 ] === 'promote' || parts[ 0 ] === 'demote' )
		{
			if ( parts[ 1 ] === 'undefined' )
			{
				if ( parts[ 0 ] === 'promote' )
				socket.emit('SERVICE_MESSAGE', 'Usage example (replace 123 with number player says when types /myid ): /promote 123' );
				else
				socket.emit('SERVICE_MESSAGE', 'Usage example (replace #5 with # and number that starts with # after executing /listadmins , _net_id will work too): /demote #5' );
			
				return;
			}
			let target = null;
			
			if ( typeof parts[ 1 ] === 'string' )
			if ( parts[ 1 ].length > 0 )
			{
				if ( parts[ 1 ].charAt( 0 ) === '#' ) // # means search in admin list
				{
					let id = ~~( parts[ 1 ].slice( 1 ) );
					
					if ( id < sdModeration.data.admins.length )
					{
						target = {
							my_hash: sdModeration.data.admins[ id ].my_hash,
							character: { title: sdModeration.data.admins[ id ].pseudonym },
							emit:()=>{},
						};
					}
				}
				else // In else case - lookup by _net_id
				{
					let id = ~~( parts[ 1 ] );

					for ( let i = 0; i < sdWorld.sockets.length; i++ )
					if ( sdWorld.sockets[ i ].my_hash )
					if ( sdWorld.sockets[ i ].character )
					if ( sdWorld.sockets[ i ].character._net_id === id )
					{
						target = sdWorld.sockets[ i ];
						break;
					}
				}
			}

			if ( target )
			{
				if ( parts[ 0 ] === 'promote' )
				{
					for ( let a = 0; a < sdModeration.data.admins.length; a++ )
					if ( sdModeration.data.admins[ a ].my_hash === target.my_hash )
					{
						if ( sdModeration.data.admins[ a ].access_level > my_admin_row.access_level + 1 )
						{
							sdModeration.data.admins[ a ].access_level = my_admin_row.access_level + 1;
							sdModeration.data.admins[ a ].promoter_hash = my_admin_row.my_hash;
							sdModeration.Save();
							socket.emit('SERVICE_MESSAGE', 'Server: Already admin, access_level has been increased and promoter updated.' );
						}
						else
						socket.emit('SERVICE_MESSAGE', 'Server: Already admin, can not increase access_level.' );

						return;
					}

					sdModeration.data.admins.push( { my_hash: target.my_hash, access_level: my_admin_row.access_level + 1, pseudonym: target.character.title, promoter_hash: my_admin_row.my_hash } );
					sdModeration.Save();
					socket.emit('SERVICE_MESSAGE', 'Server: ' + target.character.title + ' has been promoted to admin with access level ' + ( my_admin_row.access_level + 1 ) + ' (higher = less permissions).' );
					target.emit('SERVICE_MESSAGE', 'Server: ' + target.character.title + ' has been promoted to admin with access level ' + ( my_admin_row.access_level + 1 ) + ' (higher = less permissions).' );
				}
				else
				if ( parts[ 0 ] === 'demote' )
				{
					for ( let a = 0; a < sdModeration.data.admins.length; a++ )
					if ( sdModeration.data.admins[ a ].my_hash === target.my_hash )
					{
						if ( sdModeration.data.admins[ a ].access_level > my_admin_row.access_level || sdModeration.data.admins[ a ].my_hash === socket.my_hash )
						{
							sdModeration.data.admins.splice( a, 1 );
							a--;
							sdModeration.Save();
							socket.emit('SERVICE_MESSAGE', 'Server: ' + target.character.title + ' has been demoted.' );
							return;
						}
						else
						{
							socket.emit('SERVICE_MESSAGE', 'Server: ' + target.character.title + ' has higher or equal access level ' + ( sdModeration.data.admins[ a ].access_level ) + '. Your is ' + my_admin_row.access_level + ' (higher = less permissions).' );
							return;
						}
					}
					socket.emit('SERVICE_MESSAGE', 'Server: ' + target.character.title + ' had no admin permissions.' );
				}
			}
			else
			{
				socket.emit('SERVICE_MESSAGE', 'Server: Unable to find target' );
			}
		}
		else
		if ( parts[ 0 ] === 'commands' || parts[ 0 ] === 'help' || parts[ 0 ] === '?' )
		{
			if ( is_non_admin )
			socket.emit('SERVICE_MESSAGE', 'Supported commands: ' + [ '/commands', '/myid', '/listadmins', '/connection', '/kill' ].join(', ') );
			else
			socket.emit('SERVICE_MESSAGE', 'Supported commands: ' + [ '/commands', '/myid', '/listadmins', '/announce', '/quit', '/restart', '/save', '/restore', '/fullreset', '/god', '/promote', '/demote' ].join(', ') );
		}
		else
		if ( parts[ 0 ] === 'announce' )
		{
			let rest_text = parts.slice( 1 ).join(' ');
			
			for ( let i = 0; i < sdWorld.sockets.length; i++ )
			{
				if ( socket.character )
				sdWorld.sockets[ i ].emit('SERVICE_MESSAGE', 'Announcement from '+socket.character.title+': ' + rest_text );
				else
				sdWorld.sockets[ i ].emit('SERVICE_MESSAGE', 'Announcement from '+my_admin_row.pseudonym+': ' + rest_text );
			}
		}
		else
		if ( parts[ 0 ] === 'listadmins' )
		{
			let out = [];
			for ( let a = 0; a < sdModeration.data.admins.length; a++ )
			out.push( '[ #'+a+' ]: ' + sdModeration.data.admins[ a ].pseudonym + '^' + sdModeration.data.admins[ a ].access_level );
			
			if ( out.length === 0 )
			socket.emit('SERVICE_MESSAGE', 'No admins. Use /selfpromote to generate one-time-use password and then enter it like this: /selfpromote pass000' );
			else
			socket.emit('SERVICE_MESSAGE', 'Admins: ' + out.join(',   ') );
		}
		else
		if ( parts[ 0 ] === 'quit' || parts[ 0 ] === 'shutdown' || parts[ 0 ] === 'exit' )
		{
			process.exit();
		}
		else
		if ( parts[ 0 ] === 'restart' || parts[ 0 ] === 'reboot' )
		{
			if ( parts[ 1 ] === 'nosave' )
			socket.emit('SERVICE_MESSAGE', 'Server: Restarting... Without saving snapshot' );
			else
			socket.emit('SERVICE_MESSAGE', 'Server: Restarting... Saving snapshot' );
		
			console.log( "This is pid " + process.pid + ' :: parts: ' + JSON.stringify( parts ) );
			
			const proceed = ( err )=>
			{		
				if ( parts[ 1 ] === 'nosave' )
				socket.emit('SERVICE_MESSAGE', 'Server: Restarting... Snapshot saving ignored, goodbye!' );
				else
				socket.emit('SERVICE_MESSAGE', 'Server: Restarting... Snapshot saved, goodbye!' );
				
				setTimeout( function () 
				{
					socket.emit('SERVICE_MESSAGE', 'Server: Restarting... Terminating' );
				
					process.on( "exit", function () 
					{
						let args = process.argv;

						let arg0 = args.shift();

						let arg123 = ( globalThis.isWin ) ? [ '--inspect', args[ 0 ] ] : args;

						//console.log('CWD: ' + process.cwd() );

						//require( "child_process" ).spawn( process.argv.shift(), process.argv, 
						spawn( arg0, arg123, 
						{
							cwd: process.cwd(),
							detached: true,
							stdio: "inherit"
						});
					});
					process.exit();
				}, 1000 );

			};
			
			if ( parts[ 1 ] === 'nosave' )
			proceed();
			else
			sdWorld.SaveSnapshot( sdWorld.snapshot_path_const, proceed );
		}
		else
		if ( parts[ 0 ] === 'save' )
		{
			sdWorld.SaveSnapshot( sdWorld.timewarp_path_const, ( err )=>
			{		
				for ( let i = 0; i < sdWorld.sockets.length; i++ )
				sdWorld.sockets[ i ].emit( 'SERVICE_MESSAGE', 'Server: World timewarp restore point has been set ('+(err?'Error!':'successfully')+')!' );
			});
		}
		else
		if ( parts[ 0 ] === 'restore' || parts[ 0 ] === 'load' )
		{
			for ( let i = 0; i < sdWorld.sockets.length; i++ )
			sdWorld.sockets[ i ].emit( 'SERVICE_MESSAGE', 'Server: Timewarp initiated.' );

			sdWorld.PreventSnapshotSaving();
			
			let ok = 0;
			let tot = 0;
			
			const fin = ( err )=>
			{
				tot++;
				if ( !err )
				ok++;
			
				socket.emit('SERVICE_MESSAGE', 'Server: Copying files... tot: ' + tot + ', ok: ' + ok  );
			
				if ( tot === 2 )
				{
					if ( ok === 2 )
					sdModeration.CommandReceived( socket, '/restart nosave' );
					else
					{
						socket.emit('SERVICE_MESSAGE', 'Server: Unable to manage backup files. /load command execution canceled.' );
					}
				}
			};
			
			fs.copyFile( sdWorld.timewarp_path_const, sdWorld.snapshot_path_const, fs.constants.COPYFILE_FICLONE, fin );
			fs.copyFile( sdWorld.timewarp_path_const+'.raw.v', sdWorld.snapshot_path_const+'.raw.v', fs.constants.COPYFILE_FICLONE, fin );
		}
		else
		if ( parts[ 0 ] === 'fullreset' || parts[ 0 ] === 'wipe' )
		{
			for ( let i = 0; i < sdWorld.sockets.length; i++ )
			sdWorld.sockets[ i ].emit( 'SERVICE_MESSAGE', 'Server: World reset has been initated.' );

			sdWorld.PreventSnapshotSaving();
			try
			{
				fs.unlinkSync( sdWorld.snapshot_path_const );
			}catch(e){}
			
			sdModeration.CommandReceived( socket, '/restart nosave' );
		}
		else
		if ( parts[ 0 ] === 'connection' || parts[ 0 ] === 'socket' )
		{
			/*if ( !is_non_admin )
			console.log(
				'Socket command execution status: ',
				socket.max_update_rate,
				socket.left_overs
					
			);*/
	
			//socket.sent_result_ok *= 0.8;
			//socket.sent_result_dropped = 0.8;
	
			socket.emit('SERVICE_MESSAGE', 'Server: Server sends updates to you each ' + socket.max_update_rate + 'ms ('+ (~~socket.sent_result_dropped)+' dropped out of '+(~~socket.sent_result_ok)+')' );
		}
		else
		if ( parts[ 0 ] === 'god' )
		{
			if ( socket.character )
			{
				if ( parts[ 1 ] === '1' )
				{
					for ( let i = 0; i < sdWorld.sockets.length; i++ )
					sdWorld.sockets[ i ].emit('SERVICE_MESSAGE', socket.character.title + ' has entered "godmode".' );
		
					socket.character._god = true;
				}
				else
				if ( parts[ 1 ] === '0' )
				{
					for ( let i = 0; i < sdWorld.sockets.length; i++ )
					sdWorld.sockets[ i ].emit('SERVICE_MESSAGE', socket.character.title + ' is no longer in "godmode".' );
				
					socket.character._god = false;
				}
				else
				socket.emit('SERVICE_MESSAGE', 'Type /god 1 or /god 0' );
			}
			else
			socket.emit('SERVICE_MESSAGE', 'Server: No active character.' );
		}
		else
		if ( parts[ 0 ] === 'kill' )
		{
			if ( socket.character )
			{
				socket.character._god = false;
				
				if ( socket.character.hea > 0 )
				socket.character.Damage( socket.character.hea );
			}
		}
		else
		socket.emit('SERVICE_MESSAGE', 'Server: Unknown command "' + parts[ 0 ] + '"' );
	}
}
//sdModeration.init_class();

export default sdModeration;