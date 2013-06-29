if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

var EMPTY_CELL = 0;
var VOXEL_CELL = 1;
var PLAYER_CELL = 100;
var BONUS_CELL = 666;
var SPEED = 150 / 7200;

var INITIAL_CAMERA_HEIGHT = 800;

var container, stats;
var camera, scene, renderer;
var projector, plane, cube;
var movingPlane;
var mouse2D, mouse3D, raycaster,
	rollOveredFace, isShiftDown = false,
	theta = 45 * 0.5, isCtrlDown = false;

var rollOverMesh, rollOverMaterial;
var voxelPosition = new THREE.Vector3(), tmpVec = new THREE.Vector3(), normalMatrix = new THREE.Matrix3();
var cubeGeo, cubeMaterial;
var i, intersector;
var playerName, roomNumber, blocksLeft;
var cubecolor;

var gridCellSize = 100;
var gridCellNumber = 10;
var gridHeight = 11;
var worldMap = new Array();
var waterPosition = 0;

var playerPosition = new Object();
var playerGeo;
var playerMaterial;
var player;

var bonusGeo;
var bonusMaterial;

var highestLevel;
var initialTime;

var unCountedObjectArray;
var previousIndex;

$(document).ready(function() {

	//var hammertime = $(document).hammer();

/*	// the whole area
	hammertime.on("drag", function(ev) {
				console.log(this, ev);
				ev.preventDefault();
				theta += -ev.gesture.deltaX * 150/ ev.currentTarget.documentElement.clientWidth ;
				    //alert(ev.gesture.deltaX + ":" + ev.currentTarget.documentElement.clientWidth);
				});*/


	signIn();
});


function gameInit() {
	setSocket();

	ss.event.on('addBox', function(data, channelNumber) {
		if (data[0] == 0) {
			//from function onDocumentMouseDown
			if ( data[1] != plane ) {
				scene.remove( data[1] );
			}
		}
		if (data[0] == 1) {
			addVoxel( data[1], parseInt(data[2]) );
			worldMap[data[1].x][data[1].y][data[1].z - waterPosition] = VOXEL_CELL;
			blocksLeft = blocksLeft - 1;
			document.getElementById('blockNum').innerHTML = blocksLeft.toString();
		}
	});

	ss.event.on('addRewardlist', function(data, channelNumber) {
		for (var i = 0; i < data.length;i++) {
			addBonus(data[i]);
			console.log(data[i]);
		}
	});
}

function setSocket() {
	ss.rpc('demo.connectGame', playerName, roomNumber, function(initData) {
		blocksLeft = initData;
		gameboard_init();
		animate();
	});
}


function requireReward(numReward, lastReward) {
	ss.rpc('demo.requireReward', numReward, lastReward, roomNumber);
}

function gameboard_init() {
	previousIndex = new Object();
	previousIndex.x = 0;
	previousIndex.y = 0;
	previousIndex.z = 0;
	unCountedObjectArray = new Array();
	initialTime = Date.now();
	highestLevel = 0;
	for (var i = 0; i<gridCellNumber; i++) {
		worldMap[i] = new Array();
		for (var j = 0; j<gridCellNumber; j++){
			worldMap[i][j] = new Array();
			for (var k = 0; k<gridHeight; k++)
				worldMap[i][j][k] = EMPTY_CELL;
		}
	}
	playerPosition.x = 0;
	playerPosition.y = 0;
	playerPosition.z = 0;
	worldMap[playerPosition.x][playerPosition.y][playerPosition.z] = PLAYER_CELL;
	requireReward(5, playerPosition);

	container = document.createElement( 'div' );
	container.setAttribute('id', 'game_board');
	document.body.appendChild( container );

	var info = document.createElement('div');
	info.id = 'info';
	info.innerHTML = '<div id="team"><br><a>Current players:</a></div><br><a>Number of </a><img src="http://i43.tinypic.com/2v8ka3b.jpg"><a> left: </a><br><a id="blockNum">'+blocksLeft+'<br><br></a>';
	container.appendChild(info);

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 10000 );
	camera.position.y = INITIAL_CAMERA_HEIGHT;

	scene = new THREE.Scene();

	// roll-over helpers

	rollOverGeo = new THREE.CubeGeometry( gridCellSize, gridCellSize, gridCellSize );
	rollOverMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000, opacity: 0.5, transparent: true } );
	rollOverMesh = new THREE.Mesh( rollOverGeo, rollOverMaterial );
	scene.add( rollOverMesh );
	console.log(this, rollOverMesh);

	// cubes

	cubeGeo = new THREE.CubeGeometry( gridCellSize, gridCellSize, gridCellSize );
	//cubecolorfeed ="0."
	//for (var i = 0; i < playerName.length; i++) {
	//cubecolorfeed += playerName.charCodeAt(i).toString();
	//}

	//console.log(parseFloat(cubecolorfeed));
	cubecolor = '0x' + (function co(lor){   return (lor +=[0,1,2,3,4,5,6,7,8,9,'a','b','c','d','e','f'][Math.floor(Math.random()*16)]) && (lor.length == 6) ?  lor : co(lor); })('');
	document.getElementById('team').innerHTML = $('#team').html()+'<br><a style="color: #'+cubecolor.substring(2)+';">'+playerName+'</a>';	

	cubeMaterial = new THREE.MeshLambertMaterial( { color: parseInt(cubecolor), ambient: 0xffffff, shading: THREE.FlatShading } );

	//cubeMaterial = new THREE.MeshLambertMaterial( { color: 0xfeb74c, ambient: 0x00ff80, shading: THREE.FlatShading, map: THREE.ImageUtils.loadTexture( "http://threejs.org/examples/textures/square-outline-textured.png" ) } );


	playerGeo = new THREE.SphereGeometry(50,50,30);
	playerMaterial = new THREE.MeshPhongMaterial( { color: 0xfe00b7, ambient: 0xffffff, shading: THREE.FlatShading } );
	player = new THREE.Mesh(playerGeo, playerMaterial);
	player.matrixAutoUpdate = false;
	movePlayer(playerPosition);
	scene.add(player);

	bonusGeo = new THREE.TorusGeometry( 25, 10, 20, 20 );
	bonusMaterial = new THREE.MeshPhongMaterial( { color: 0xffff00, ambient: 0x555555, specular: 0xffffff, metal: true } );


	// picking

	projector = new THREE.Projector();

	// grid

	var gridSize = gridCellSize * gridCellNumber;

	plane = new THREE.Mesh( new THREE.PlaneGeometry( gridSize, gridSize, gridCellNumber, gridCellNumber ), new THREE.MeshBasicMaterial( { color: 0x555555, wireframe: true } ) );
	plane.rotation.x = - Math.PI / 2;
	scene.add( plane );
	var waterMaterial = new THREE.MeshBasicMaterial( { color: 0x00aaaa, opacity: 0.2, transparent: true} );
	waterMaterial.depthTest = false;
	movingPlane = new THREE.Mesh( new THREE.CubeGeometry( gridSize, gridSize, 10 ), waterMaterial);
	movingPlane.y = -100;
	movingPlane.rotation.x = - Math.PI / 2;
	scene.add( movingPlane );
	//unCountedObjectArray.push(movingPlane);

	mouse2D = new THREE.Vector3( 0, 10000, 0.5 );

	// Lights

	var ambientLight = new THREE.AmbientLight( 0x606060 );
	scene.add( ambientLight );

	var directionalLight = new THREE.DirectionalLight( 0xffffff );
	directionalLight.position.set( 1, 0.75, 0.5 ).normalize();
	scene.add( directionalLight );

	renderer = new THREE.WebGLRenderer( { antialias: true, preserveDrawingBuffer: true } );
	renderer.setSize( window.innerWidth, window.innerHeight );

	$('#game_board').append("<div id='grid'></div>");
	$('#grid').append( renderer.domElement );

	stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0px';
	$('#grid').append( stats.domElement );
	$('#grid').bind('mousedown', onDocumentMouseDown);
	$('#grid').bind('mousemove', onDocumentMouseMove);

	document.addEventListener( 'keydown', onDocumentKeyDown, false );
	document.addEventListener( 'keyup', onDocumentKeyUp, false );

	$(window).keypress(function(e){
		var new_position = new Object();
		new_position.x = playerPosition.x;
		new_position.y = playerPosition.y;
		new_position.z = playerPosition.z;
		switch (e.which) {
			case 115:
				console.log('down');
				new_position.y++;
				break;
			case 119:
				console.log('up');
				new_position.y--;
				break;
			case 97:
				console.log('left');
				new_position.x--;
				break;
			case 100:
				console.log('right');
				new_position.x++;
				break;
			default:
		}
		movePlayer(new_position);
	});

	window.addEventListener( 'resize', onWindowResize, false );
}

function signIn() {
	$('#sign_up').lightbox_me({
		centered: true,
	onLoad: function() {
		$('#sign_up').find('input:first').focus()
	},
	onClose: function() {
		playerName = $('input[name="player_name"]').val();
		roomNumber = $('input[name="room_number"]').val();
		if (playerName == '' || roomNumber == '') {
			$('#emptyInput').attr('style','visibility: visible;');
			signIn();
		}
		else {
			gameInit();
		}
	},
	closeSelector: ".confirm"
	});
}


function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}


function getRealIntersector( intersects ) {

	for( i = 0; i < intersects.length; i++ ) {

		intersector = intersects[ i ];
		if (intersector.object == movingPlane)
			continue;
		if (intersector.object == player)
			continue;
		if (intersector.object == rollOverMesh)
			continue;
		var check = 1;
		for (var j = 0; j < unCountedObjectArray.length; j++){
			
			if (intersector.object == unCountedObjectArray[j]){
				
				check = 0;
				break;
				
			}
		}
		if (check == 1)
			return intersector;

	}

	return null;

}

function setVoxelPosition( intersector ) {
	var tmpPosition = new THREE.Vector3();

	normalMatrix.getNormalMatrix( intersector.object.matrixWorld );

	tmpVec.copy( intersector.face.normal );
	tmpVec.applyMatrix3( normalMatrix ).normalize();

	tmpPosition.addVectors( intersector.point, tmpVec );

	var centerPosition = new THREE.Vector3();
	
	centerPosition.x = Math.floor( tmpPosition.x / gridCellSize ) * gridCellSize + gridCellSize/2;
	centerPosition.y = Math.floor( tmpPosition.y / gridCellSize ) * gridCellSize + gridCellSize/2;
	centerPosition.z = Math.floor( tmpPosition.z / gridCellSize ) * gridCellSize + gridCellSize/2;
/*	
	if (Math.abs(centerPosition.x - tmpPosition.x) > (7 / 16) * gridCellSize)
		return;
	if (Math.abs(centerPosition.y - tmpPosition.y) > (4 / 8) * gridCellSize)
		return;
	if (Math.abs(centerPosition.z - tmpPosition.z) > (7 / 16) * gridCellSize)
		return;
	*/
	var index = new Object();
	index.x = Math.floor( tmpPosition.x / gridCellSize ) + gridCellNumber / 2;
	index.y = Math.floor( tmpPosition.z / gridCellSize ) + gridCellNumber / 2;
	index.z = Math.floor( tmpPosition.y / gridCellSize );
	
	if (index.x == playerPosition.x && index.y == playerPosition.y && index.z == playerPosition.z)
		return;
	
	for (var i = 0; i < unCountedObjectArray.length; i++){
		var object = unCountedObjectArray[i];
		if (index.x == object.index.x && index.y == object.index.y && index.z == object.index.z)
			return;
	}
	
	voxelPosition = centerPosition;

}

function onDocumentMouseMove( event ) {

	event.preventDefault();

	mouse2D.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	mouse2D.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

	raycaster = projector.pickingRay( mouse2D.clone(), camera );

	var intersects = raycaster.intersectObjects( scene.children );

	if ( intersects.length > 0 ) {

		intersector = getRealIntersector( intersects );
		if ( intersector ) {

			setVoxelPosition( intersector );
			rollOverMesh.position = voxelPosition;
			
			var index = new Object();
			index.x = Math.floor( voxelPosition.x / gridCellSize ) + gridCellNumber / 2;
			index.y = Math.floor( voxelPosition.z / gridCellSize ) + gridCellNumber / 2;
			index.z = Math.floor( voxelPosition.y / gridCellSize );
			
			rollOverMesh.index = index;

		}

	}
}

function onDocumentMouseDown( event ) {

	event.preventDefault();

	var intersects = raycaster.intersectObjects( scene.children );
	intersector = getRealIntersector( intersects );

	if ( intersects.length > 0 ) {

		intersector = getRealIntersector( intersects );
		if (intersector == null)
			return;

		if ( isCtrlDown ) {
			//if ( intersector.object != plane ) {
			//scene.remove( intersector.object );
			//}

			// delete cube
			ss.rpc('demo.clientMove', [0, intersector.object], roomNumber);
		} else {
			// create cube
			normalMatrix.getNormalMatrix( intersector.object.matrixWorld );

			tmpVec.copy( intersector.face.normal );
			tmpVec.applyMatrix3( normalMatrix ).normalize();

			// Convert into matrix index and call addVoxel function to add
			var index = new Object();
			index.x = Math.floor( voxelPosition.x / gridCellSize ) + gridCellNumber / 2;
			index.y = Math.floor( voxelPosition.z / gridCellSize ) + gridCellNumber / 2;
			index.z = Math.floor( voxelPosition.y / gridCellSize );
			if (index.x == previousIndex.x && index.y == previousIndex.y && index.z == previousIndex.z){
				ss.rpc('demo.clientMove', [1, index, cubecolor], roomNumber);
			} else{
				previousIndex = index;
			}
		}
	}
}

function onDocumentKeyDown( event ) {

	switch( event.keyCode ) {

		case 16: isShiftDown = true; break;
		case 17: isCtrlDown = true; break;

	}

}

function onDocumentKeyUp( event ) {

	switch ( event.keyCode ) {

		case 16: isShiftDown = false; break;
		case 17: isCtrlDown = false; break;

	}

}

function animate() {

	requestAnimationFrame( animate );

	render();
	stats.update();

}

function render() {

	if ( isShiftDown ) {

		theta += mouse2D.x * 1.5;

	}

	/*raycaster = projector.pickingRay( mouse2D.clone(), camera );

	var intersects = raycaster.intersectObjects( scene.children );

	if ( intersects.length > 0 ) {

		intersector = getRealIntersector( intersects );
		if ( intersector ) {

			setVoxelPosition( intersector );
			rollOverMesh.position = voxelPosition;

		}

	}*/
	var currentWaterHeight = (Date.now() - initialTime ) * SPEED;
	waterPosition = Math.floor(currentWaterHeight / gridCellSize);

	console.log(waterPosition);
	camera.position.x = 1400 * Math.sin( THREE.Math.degToRad( theta ) );
	camera.position.z = 1400 * Math.cos( THREE.Math.degToRad( theta ) );
	camera.position.y = currentWaterHeight + INITIAL_CAMERA_HEIGHT;
	
	movingPlane.position.copy( new THREE.Vector3(0,currentWaterHeight / 2,0) );
	movingPlane.scale.z = (currentWaterHeight) / 10;
	
	camera.lookAt( new THREE.Vector3(0,currentWaterHeight,0));
	renderer.render( scene, camera );

}

function addVoxel(position, materialColor) {
	if (position.x < 0 || position.x >= gridCellNumber)
		return;
	if (position.y < 0 || position.y >= gridCellNumber)
		return;
	if (position.z < 0) 
		return;
	cubeMaterial = new THREE.MeshLambertMaterial( { color: materialColor, ambient: 0xffffff, shading: THREE.FlatShading } );
	var voxel = new THREE.Mesh( cubeGeo, cubeMaterial );
	var gridSize = gridCellSize * gridCellNumber;
	var xCoordinate = position.x * gridCellSize + gridCellSize / 2 - gridSize / 2;
	var yCoordinate = position.z * gridCellSize + gridCellSize / 2;
	var zCoordinate = position.y * gridCellSize + gridCellSize / 2 - gridSize / 2;
	voxel.position.copy( new THREE.Vector3(xCoordinate,yCoordinate,zCoordinate) );
	voxel.matrixAutoUpdate = false;
	voxel.updateMatrix();
	if (position.z > highestLevel)
		highestLevel = position.z;
	scene.add( voxel );
}

function movePlayer(position) {
	if (position.x < 0 || position.x >= gridCellNumber)
		return;
	if (position.y < 0 || position.y >= gridCellNumber)
		return;
	if (position.z < 0) 
		return;
	var xMoved = Math.abs(position.x - playerPosition.x);
	var yMoved = Math.abs(position.y - playerPosition.y);
	if (xMoved + yMoved > 1)
		return;
	if (position.z < playerPosition.z || position.z - playerPosition.z > 1)
		return;
	///////

	if (worldMap[position.x][position.y][position.z - waterPosition] = 1) {}


	///////

	//webGL update bot object
	var gridSize = gridCellSize * gridCellNumber;
	var xCoordinate = position.x * gridCellSize + gridCellSize / 2 - gridSize / 2;
	var yCoordinate = position.z * gridCellSize + gridCellSize / 2;
	var zCoordinate = position.y * gridCellSize + gridCellSize / 2 - gridSize / 2;
	player.position.copy( new THREE.Vector3(xCoordinate,yCoordinate,zCoordinate) );
	player.updateMatrix();

	//update global var
	playerPosition.x = position.x;
	playerPosition.y = position.y;
	playerPosition.z = position.z;

	//update world map
	worldMap[playerPosition.x][playerPosition.y][playerPosition.z - waterPosition] = EMPTY_CELL;
	playerPosition.x = position.x;
	playerPosition.y = position.y;
	playerPosition.z = position.z;
	worldMap[playerPosition.x][playerPosition.y][playerPosition.z - waterPosition] = PLAYER_CELL;
	if (position.z > highestLevel)
		highestLevel = position.z;
}

function waterFlow() {
	//wrap world map
	if ( (waterPosition + 1) == gridHeight) {
		waterPosition = 0;
	} else {
		waterPosition++;
	}
}

function addBonus( position ) {
	if (position.x < 0 || position.x >= gridCellNumber)
		return;
	if (position.y < 0 || position.y >= gridCellNumber)
		return;
	if (position.z < 0) 
		return;
	var bonus = new THREE.Mesh( bonusGeo, bonusMaterial );
	var gridSize = gridCellSize * gridCellNumber;
	var xCoordinate = position.x * gridCellSize + gridCellSize / 2 - gridSize / 2;
	var yCoordinate = position.z * gridCellSize + gridCellSize / 2;
	var zCoordinate = position.y * gridCellSize + gridCellSize / 2 - gridSize / 2;
	bonus.position.copy( new THREE.Vector3(xCoordinate,yCoordinate,zCoordinate) );
	bonus.matrixAutoUpdate = false;
	bonus.updateMatrix();
	bonus.index = position;
	worldMap[position.x][position.y][position.z] = BONUS_CELL;
	if (position.z > highestLevel)
		highestLevel = position.z;
	scene.add( bonus );
	unCountedObjectArray.push(bonus);
	console.log(this, unCountedObjectArray);
}
