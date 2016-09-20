// GraphBase.js

//---------------------------------------------------------------------------
// ★GraphBaseクラス 線や領域情報を管理する
//---------------------------------------------------------------------------
// GraphBaseクラスの定義
pzpr.classmgr.makeCommon({
GraphBase:{

	enabled : false,
	relation : [],
	
	pointgroup : '',
	linkgroup  : '',
	
	//--------------------------------------------------------------------------------
	// graph.removeFromArray()    Arrayからitemを取り除く
	//--------------------------------------------------------------------------------
	removeFromArray : function(array, item){
		var idx = array.indexOf(item);
		if(idx>=0){ Array.prototype.splice.call(array, idx, 1);}
	},
		
	//--------------------------------------------------------------------------------
	// graph.setComponentRefs()    objにcomponentの設定を行う (性能対策)
	// 
	// graph.getObjNodeList()      objにあるnodeを取得する
	// graph.resetObjNodeList()    objからnodeをクリアする
	//--------------------------------------------------------------------------------
	setComponentRefs : function(obj, component){},
	
	getObjNodeList   : function(nodeobj){ return [];},
	resetObjNodeList : function(nodeobj){ },
	
	//--------------------------------------------------------------------------------
	// graph.isnodevalid()           そのセルにNodeが存在すべきかどうか返す
	// graph.isedgevalidbylinkobj()  そのborderにEdgeが存在すべきかどうか返す
	// graph.isedgevalidbynodeobj()  接続してはいけないかどうか判定する
	// graph.isedgeexistsbylinkobj() linkobjにedgeが存在するか判定する
	//--------------------------------------------------------------------------------
	isnodevalid           : function(nodeobj){ return false;},
	isedgevalidbylinkobj  : function(linkobj){ return true;},
	isedgevalidbynodeobj  : function(nodeobj1, nodeobj2){ return true;},
	isedgeexistsbylinkobj : function(linkobj){
		var sidenodes = this.getSideNodesBySeparator(linkobj);
		if(sidenodes.length<2){ return false;}
		return sidenodes[0].nodes.indexOf(sidenodes[1])>=0;
	},
	
	//--------------------------------------------------------------------------------
	// graph.calcNodeCount()    そのセルにあるべきNode数を返す
	//--------------------------------------------------------------------------------
	calcNodeCount : function(cell){ return (this.isnodevalid(cell)?1:0);},
	
	//---------------------------------------------------------------------------
	// graph.rebuild()  既存の情報からデータを再設定する
	// graph.rebuild2() 継承先に固有のデータを設定する
	//---------------------------------------------------------------------------
	rebuildmode : false,
	rebuild : function(){
		if(!this.enabled){ return;}

		this.rebuildmode = true;

		this.components  = [];
		this.modifyNodes = [];

		this.rebuild2();

		this.searchGraph();

		this.rebuildmode = false;
	},
	rebuild2 : function(){
		var nodeobjs = this.board[this.pointgroup], linkobjs = this.board[this.linkgroup];
		for(var c=0;c<nodeobjs.length;c++){
			this.setComponentRefs(nodeobjs[c], null);
			this.resetObjNodeList(nodeobjs[c]);
			if(this.isnodevalid(nodeobjs[c])){ this.createNode(nodeobjs[c]);}
		}
		if(this.linkgroup){
			for(var id=0;id<linkobjs.length;id++){
				this.setComponentRefs(linkobjs[id], null);
				if(this.isedgevalidbylinkobj(linkobjs[id])){ this.addEdgeByLinkObj(linkobjs[id]);}
			}
		}
		else{
			for(var c=0;c<nodeobjs.length;c++){
				if(this.isnodevalid(nodeobjs[c])){ this.putEdgeByNodeObj(nodeobjs[c]);}
			}
		}
	},

	//---------------------------------------------------------------------------
	// graph.createComponent()  GraphComponentオブジェクトを作成する
	// graph.deleteComponent()  GraphComponentオブジェクトを削除してNodeをmodifyNodesに戻す
	//---------------------------------------------------------------------------
	createComponent : function(){
		var component = new this.klass.GraphComponent();
		this.components.push(component);
		return component;
	},
	deleteComponent : function(component){
		for(var i=0;i<component.nodes.length;i++){
			this.modifyNodes.push(component.nodes[i]);
			this.setComponentRefs(component.nodes[i].obj, null);
			component.nodes[i].component = null;
		}
		this.removeFromArray(this.components, component);
	},

	//---------------------------------------------------------------------------
	// graph.createNode()    GraphNodeオブジェクトを生成する
	// graph.deleteNode()    GraphNodeオブジェクトをグラフから削除する (先にEdgeを0本にしてください)
	//---------------------------------------------------------------------------
	createNode : function(cell){
		var node = new this.klass.GraphNode(cell);
		this.getObjNodeList(cell).push(node);
		this.modifyNodes.push(node);
		return node;
	},
	deleteNode : function(node){
		var cell = node.obj;
		this.setComponentRefs(cell, null);
		this.removeFromArray(this.getObjNodeList(cell), node);
		
		// rebuildmode中にはこの関数は呼ばれません
		this.removeFromArray(this.modifyNodes, node);
		var component = node.component;
		if(component!==null){
			this.removeFromArray(component.nodes, node);
			this.resetExtraData(cell);
			if(component.nodes.length===0){
				this.deleteComponent(component);
			}
		}
	},

	//---------------------------------------------------------------------------
	// linegraph.createNodeIfEmpty()  指定されたオブジェクトの場所にNodeを生成する
	// linegraph.deleteNodeIfEmpty()  指定されたオブジェクトの場所からNodeを除去する
	//---------------------------------------------------------------------------
	createNodeIfEmpty : function(nodeobj){
		// 周囲のNode生成が必要かもしれないのでチェック＆create
		if(this.getObjNodeList(nodeobj).length===0){
			this.createNode(nodeobj);
		}
	},
	deleteNodeIfEmpty : function(nodeobj){
		var nodes = this.getObjNodeList(nodeobj);
		
		// 周囲のNodeが消えるかもしれないのでチェック＆remove
		if(nodes[0].nodes.length===0 && !this.isnodevalid(nodeobj)){
			this.deleteNode(nodes[0]);
		}
	},

	//---------------------------------------------------------------------------
	// graph.addEdge()    Node間にEdgeを追加する
	// graph.removeEdge() Node間からEdgeを除外する
	//---------------------------------------------------------------------------
	addEdge : function(node1, node2){
		if(node1.nodes.indexOf(node2)>=0){ return;} // 多重辺にしないため
		node1.nodes.push(node2);
		node2.nodes.push(node1);
		
		if(!this.rebuildmode){
			if(this.modifyNodes.indexOf(node1)<0){ this.modifyNodes.push(node1);}
			if(this.modifyNodes.indexOf(node2)<0){ this.modifyNodes.push(node2);}
		}
	},
	removeEdge : function(node1, node2){
		if(node1.nodes.indexOf(node2)<0){ return;} // 存在しない辺を削除しない
		this.removeFromArray(node1.nodes, node2);
		this.removeFromArray(node2.nodes, node1);
		
		if(!this.rebuildmode){
			if(this.modifyNodes.indexOf(node1)<0){ this.modifyNodes.push(node1);}
			if(this.modifyNodes.indexOf(node2)<0){ this.modifyNodes.push(node2);}
		}
	},

	//---------------------------------------------------------------------------
	// graph.getSideObjByLinkObj()   borderから接続するNodeにあるobjを取得する
	// graph.getSideObjByNodeObj()   cellから接続するNodeにあるobjを取得する
	//---------------------------------------------------------------------------
	getSideObjByLinkObj : function(border){
		return border.sideobj;
	},
	getSideObjByNodeObj : function(cell){
		var list = cell.getdir4clist(), cells = [];
		for(var i=0;i<list.length;i++){
			var cell2 = list[i][0];
			if(this.isnodevalid(cell2)){ cells.push(cell2);}
		}
		return cells;
	},

	//---------------------------------------------------------------------------
	// graph.getSideNodesByLinkObj()   borderからEdgeに接続するNodeを取得する
	// graph.getSideNodesBySeparator() borderからEdgeに接続するNodeを取得する
	//---------------------------------------------------------------------------
	getSideNodesByLinkObj : function(border){
		var sidenodes = [], sidenodeobj = this.getSideObjByLinkObj(border);
		for(var i=0;i<sidenodeobj.length;i++){
			var cell = sidenodeobj[i], nodes = this.getObjNodeList(cell), node = nodes[0];
			// 交差あり盤面の特殊処理 border.isvertはfalseの時タテヨコ線
			if(!!nodes[1] && border.isvert){ node = nodes[1];}
			sidenodes.push(node);
		}
		return sidenodes;
	},
	getSideNodesBySeparator : function(border){
		var sidenodes = [], sidenodeobj = border.sideobj;
		for(var i=0;i<sidenodeobj.length;i++){
			var nodes = this.getObjNodeList(sidenodeobj[i]);
			if(!!nodes && !!nodes[0]){ sidenodes.push(nodes[0]);}
		}
		return sidenodes;
	},

	//---------------------------------------------------------------------------
	// graph.setEdgeByLinkObj() 線が引かれたり消された時に、lcnt変数や線の情報を生成しなおす
	//---------------------------------------------------------------------------
	setEdgeByLinkObj : function(linkobj){
		var isset = this.isedgevalidbylinkobj(linkobj);
		if(isset===this.isedgeexistsbylinkobj(linkobj)){ return;}

		this.modifyNodes = [];

		if(isset){ this.addEdgeByLinkObj(linkobj);}
		else     { this.removeEdgeByLinkObj(linkobj);}

		this.remakeComponent();
	},

	//---------------------------------------------------------------------------
	// graph.setEdgeBySeparator() 境界線が引かれたり消された時に、lcnt変数や線の情報を生成しなおす
	//---------------------------------------------------------------------------
	setEdgeBySeparator : function(border){
		var isset = this.isedgevalidbylinkobj(border);
		if(isset===this.isedgeexistsbylinkobj(border)){ return;}

		this.modifyNodes = [];

		if(isset){ this.addEdgeBySeparator(border);}
		else     { this.removeEdgeBySeparator(border);}

		this.remakeComponent();
	},

	//---------------------------------------------------------------------------
	// graph.setEdgeByNodeObj() 黒マスになったりした時にブロックの情報を生成しなおす
	// graph.putEdgeByNodeObj() 黒マスになったりした時にブロックの情報を生成しなおす
	//---------------------------------------------------------------------------
	setEdgeByNodeObj : function(nodeobj){
		this.modifyNodes = [];

		this.putEdgeByNodeObj(nodeobj);

		this.remakeComponent();
	},
	putEdgeByNodeObj : function(cell){
		if(this.calcNodeCount(cell)===0 && this.getObjNodeList(cell).length===0){ return;}
		
		// 一度Edgeを取り外す
		this.removeEdgeByNodeObj(cell);
			
		// Edgeを付け直す
		this.addEdgeByNodeObj(cell);
	},

	//---------------------------------------------------------------------------
	// graph.addEdgeByLinkObj()    指定されたオブジェクトの場所にEdgeを生成する
	// graph.removeEdgeByLinkObj() 指定されたオブジェクトの場所からEdgeを除去する
	//---------------------------------------------------------------------------
	addEdgeByLinkObj : function(linkobj){
		var sidenodeobj = this.getSideObjByLinkObj(linkobj);
		
		// 周囲のNodeをグラフに追加するかどうか確認する
		this.createNodeIfEmpty(sidenodeobj[0]);
		this.createNodeIfEmpty(sidenodeobj[1]);

		// linkするNodeを取得する
		var sidenodes = this.getSideNodesByLinkObj(linkobj);

		// 周囲のNodeとlink
		this.addEdge(sidenodes[0], sidenodes[1]);
	},
	removeEdgeByLinkObj : function(linkobj){
		// unlinkするNodeを取得する
		var sidenodes = this.getSideNodesByLinkObj(linkobj);

		// 周囲のNodeとunlink
		this.removeEdge(sidenodes[0], sidenodes[1]);

		// 周囲のNodeをグラフから取り除くかどうか確認する
		this.deleteNodeIfEmpty(sidenodes[0].obj);
		this.deleteNodeIfEmpty(sidenodes[1].obj);

		if(this.linkgroup){
			this.setComponentRefs(linkobj, null);
		}
	},

	//---------------------------------------------------------------------------
	// graph.addEdgeBySeparator()    指定されたオブジェクトの場所にEdgeを生成する
	// graph.removeEdgeBySeparator() 指定されたオブジェクトの場所からEdgeを除去する
	//---------------------------------------------------------------------------
	addEdgeBySeparator : function(border){
		var sidenodes = this.getSideNodesBySeparator(border);
		if(sidenodes.length>=2){
			this.addEdge(sidenodes[0], sidenodes[1]);
		}
	},
	removeEdgeBySeparator : function(border){
		var sidenodes = this.getSideNodesBySeparator(border);
		if(sidenodes.length>=2){
			this.removeEdge(sidenodes[0], sidenodes[1]);
		}
	},

	//---------------------------------------------------------------------------
	// graph.removeEdgeByNodeObj() 黒マスになったりした時にブロックの情報を消去する
	// graph.addEdgeByNodeObj()    黒マスになったりした時にブロックの情報を生成する
	//---------------------------------------------------------------------------
	removeEdgeByNodeObj : function(cell){
		// Edgeの除去
		var sidenodeobj = this.getSideObjByNodeObj(cell);
		var node1 = this.getObjNodeList(cell)[0];
		for(var i=0;i<sidenodeobj.length;i++){
			var node2 = this.getObjNodeList(sidenodeobj[i])[0];
			if(!!node1 && !!node2){ this.removeEdge(node1, node2);}
		}

		// Nodeを一旦取り除く
		if(!!node1){ this.deleteNode(node1);}
	},
	addEdgeByNodeObj : function(cell){
		// Nodeを付加する
		for(var i=0,len=this.calcNodeCount(cell);i<len;i++){ this.createNode(cell);}
		
		// Edgeの付加
		var sidenodeobj = this.getSideObjByNodeObj(cell);
		var node1 = this.getObjNodeList(cell)[0];
		for(var i=0;i<sidenodeobj.length;i++){
			if(!this.isedgevalidbynodeobj(cell, sidenodeobj[i])){ continue;}
			var node2 = this.getObjNodeList(sidenodeobj[i])[0];
			if(!!node1 && !!node2){ this.addEdge(node1, node2);}
		}
	},

	//---------------------------------------------------------------------------
	// graph.remakeComponent() modifyNodesに含まれるsubgraph成分からremakeしたりします
	// graph.getAffectedComponents() modifyNodesを含むcomponentsを取得します
	// graph.checkDividedComponent() 指定されたComponentがひとつながりかどうか探索します
	// graph.remakeMaximalComonents()指定されたcomponentsを探索し直します
	//---------------------------------------------------------------------------
	remakeComponent : function(){
		// subgraph中にcomponentが何種類あるか調べる
		var remakeComponents = this.getAffectedComponents();
		
		// Component数が1ならsubgraphが分断していないかどうかチェック
		if(remakeComponents.length===1){
			this.checkDividedComponent(remakeComponents[0]);
		}
		
		// Component数が0なら現在のmodifyNodesに新規IDを割り振り終了
		// Component数が2以上ならmodifyNodesに極大部分グラフを取り込んで再探索
		if(!!this.modifyNodes && this.modifyNodes.length>0){
			this.remakeMaximalComonents(remakeComponents);
		}
	},
	getAffectedComponents : function(){
		var remakeComponents = [];
		for(var i=0;i<this.modifyNodes.length;i++){
			var component = this.modifyNodes[i].component;
			if(component!==null){
				if(!component.isremake){
					remakeComponents.push(component);
					component.isremake = true;
				}
			}
		}
		return remakeComponents;
	},
	checkDividedComponent : function(component){
		// 1つだけsubgraphを生成してみる
		for(var i=0,len=this.modifyNodes.length;i<len;i++){
			var node = this.modifyNodes[i];
			node.component = null;
			this.setComponentRefs(node.obj, null);
			this.removeFromArray(component.nodes, node);
		}
		var pseudoComponent = new this.klass.GraphComponent();
		this.searchSingle(this.modifyNodes[0], pseudoComponent);
		// subgraphがひとつながりならComponentに属していないNodeをそのComponentに割り当てる
		if(pseudoComponent.nodes.length===this.modifyNodes.length){
			for(var i=0;i<this.modifyNodes.length;i++){
				var node = this.modifyNodes[i];
				node.component = component;
				this.setComponentRefs(node.obj, component);
				component.nodes.push(node);
			}
			this.modifyNodes = [];
			this.setComponentInfo(component);
			component.isremake = false;
		}
		// subgraphがひとつながりでないなら再探索ルーチンを回す
	},
	remakeMaximalComonents : function(remakeComponents){
		var longColor = this.getLongColor(remakeComponents);
		for(var p=0;p<remakeComponents.length;p++){
			this.deleteComponent(remakeComponents[p]);
		}
		var newComponents = this.searchGraph();
		this.setLongColor(newComponents, longColor);
	},

	//---------------------------------------------------------------------------
	// graph.searchGraph()  ひとつながりの線にlineidを設定する
	// graph.searchSingle() 初期idを含む一つの領域内のareaidを指定されたものにする
	//---------------------------------------------------------------------------
	searchGraph : function(){
		var partslist = this.modifyNodes;
		var newcomponents = [];
		for(var i=0,len=partslist.length;i<len;i++){
			partslist[i].component = null;
		}
		for(var i=0,len=partslist.length;i<len;i++){
			if(partslist[i].component!==null){ continue;}	// 既にidがついていたらスルー
			var component = this.createComponent();
			this.searchSingle(partslist[i], component);
			this.setComponentInfo(component);
			newcomponents.push(component);
		}
		this.modifyNodes = [];
		return newcomponents;
	},
	searchSingle : function(startparts, component){
		var stack = [startparts];
		while(stack.length>0){
			var node = stack.pop();
			if(node.component!==null){ continue;}

			node.component = component;
			component.nodes.push(node);

			for(var i=0;i<node.nodes.length;i++){ stack.push(node.nodes[i]);}
		}
	},

	//--------------------------------------------------------------------------------
	// graph.setComponentInfo() Componentオブジェクトのデータを設定する
	//--------------------------------------------------------------------------------
	setComponentInfo : function(component){
		var edges = 0;
		for(var i=0;i<component.nodes.length;i++){
			var node = component.nodes[i];
			edges += node.nodes.length;
			
			this.setComponentRefs(node.obj, component);
		}
		component.circuits = (edges>>1) - component.nodes.length + 1;
		
		this.setExtraData(component);
	},

	//--------------------------------------------------------------------------------
	// graph.resetExtraData() 指定されたオブジェクトの拡張データをリセットする
	// graph.setExtraData()   指定された領域の拡張データを設定する
	//--------------------------------------------------------------------------------
	resetExtraData : function(nodeobj){},
	setExtraData : function(component){},

	//--------------------------------------------------------------------------------
	// graph.getLongColor() ブロックを設定した時、ブロックにつける色を取得する
	// graph.setLongColor() ブロックに色をつけなおす
	// graph.repaintNodes() ブロックを再描画する
	//--------------------------------------------------------------------------------
	getLongColor : function(components){
		// 周りで一番大きな線は？
		var largeComponent = components[0];
		for(var i=1;i<components.length;i++){
			if(largeComponent.nodes.length < components[i].nodes.length){ largeComponent = components[i];}
		}
		return (!!largeComponent ? largeComponent.color : this.puzzle.painter.getNewLineColor());
	},
	setLongColor : function(components, longColor){
		if(components.length===0){ return;}
		var puzzle = this.puzzle;
		
		// できた線の中でもっとも長いものを取得する
		var largeComponent = components[0];
		for(var i=1;i<components.length;i++){
			if(largeComponent.nodes.length < components[i].nodes.length){ largeComponent = components[i];}
		}
		
		// 新しい色の設定
		for(var i=0;i<components.length;i++){
			var path = components[i];
			path.color = (path===largeComponent ? longColor : path.color);
		}
		
		if(puzzle.execConfig('irowake') || puzzle.execConfig('irowakeblk')){
			this.repaintNodes(components);
		}
	},
	repaintNodes : function(components){},

	//---------------------------------------------------------------------------
	// graph.newIrowake()  線の情報が再構築された際、線に色をつける
	//---------------------------------------------------------------------------
	newIrowake : function(){
		var paths = this.components;
		for(var i=0;i<paths.length;i++){
			paths[i].color = this.puzzle.painter.getNewLineColor();
		}
	}
},
GraphComponent:{
	initialize : function(){
		this.nodes = [];
		this.color = '';
		this.circuits = -1;
	},

	//---------------------------------------------------------------------------
	// component.getLinkObjByNodes()  node間のオブジェクトを取得する
	//---------------------------------------------------------------------------
	getLinkObjByNodes : function(node1, node2){
		var bx1=node1.obj.bx, by1=node1.obj.by, bx2=node2.obj.bx, by2=node2.obj.by;
		if(bx1>bx2||((bx1===bx2)&&(by1>by2))){ return null;}
		return this.board.getobj(((bx1+bx2)>>1), ((by1+by2)>>1));
	},

	//---------------------------------------------------------------------------
	// component.getnodeobjs()  nodeのオブジェクトリストを取得する
	// component.getedgeobjs()  edgeのオブジェクトリストを取得する
	//---------------------------------------------------------------------------
	getnodeobjs : function(){
		var objs = new (this.board.getGroup(this.nodes[0].obj.group).constructor)();
		for(var i=0;i<this.nodes.length;i++){ objs.add(this.nodes[i].obj);}
		return objs;
	},
	getedgeobjs : function(){
		var objs = [];
		for(var i=0;i<this.nodes.length;i++){
			var node = this.nodes[i];
			for(var n=0;n<node.nodes.length;n++){
				var obj = this.getLinkObjByNodes(node, node.nodes[n]);
				if(!!obj){ objs.push(obj);}
			}
		}
		return objs;
	},

	//---------------------------------------------------------------------------
	// component.setedgeerr()   edgeにerror値を設定する
	// component.setedgeinfo()  edgeにqinfo値を設定する
	//---------------------------------------------------------------------------
	setedgeerr : function(val){
		var objs = this.getedgeobjs();
		for(var i=0;i<objs.length;i++){ objs[i].seterr(val);}
	},
	setedgeinfo : function(val){
		var objs = this.getedgeobjs();
		for(var i=0;i<objs.length;i++){ objs[i].setinfo(val);}
	}
},
GraphNode:{
	initialize : function(obj){
		this.obj   = obj;
		this.nodes = [];	// Array of Linked GraphNode
		this.component = null;
	}
}
});
