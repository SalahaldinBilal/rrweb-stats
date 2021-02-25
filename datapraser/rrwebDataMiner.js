import {IncrementalSource, MouseInteractions} from '/node_modules/rrweb/es/rrweb/src/types.js'
import {Stats} from './stats.js'

function sortObject(object){
    return Object.keys(object).sort().reduce((r, k) => (r[k] = object[k], r), {});
}

function calculateTimeDifference(date1, date2){
    return (date2 - date1) /1000;
}

const eventTypes = {};
(function(eventTypes){
    eventTypes[eventTypes["documentLoad"] = 0] = "documentLoad";
    eventTypes[eventTypes["mouseEnter"] = 1] = "mouseEnter";
    eventTypes[eventTypes["mouseLeave"] = 2] = "mouseLeave";
    eventTypes[eventTypes["click"] = 3] = "click";
})(eventTypes);

class rrwebDataMiner{
    constructor(config){
        
        this.defaultConfig = {
            sessions : null,
            leafTypes : [
                "input",
                "button",
                "a"
            ]
        }
        
        this.config = {...this.defaultConfig, ...config}
        
        if(!this.config.sessions || this.config.sessions.length === 0) throw new Error('Events must be provided at initlization');
        
        this.snapshot = this.config.sessions[0][3].data.node;
        this.leaves = this._findLeaves();
        this.organizedEvents = Array(this.config.sessions.length).fill().map(() => ({}));
        this.movementSpeeds = [];
        this._organizeEvents();
        this.parsedData = {}

        this.leaves.forEach(leaf => {
            this.parsedData[leaf] = {clicks:0, hovers:0, hoverAndClick:0, visitorClicks:0, clickTimes:[], hoverTimes:[], hoverToClickTimes:[], hoverDurTimes:[]};
        })
        
        this._parseEvents();
    }

    _calculateOverLeaves(formula){
        let result = {};
        this.leaves.forEach(leaf => result[leaf] = formula(leaf));
        return result;
    }

    _parseEvents(){
        for(let si = 0, session = this.organizedEvents[si]; si < Object.keys(this.organizedEvents).length; si++, session = this.organizedEvents[si]){
            let startTime;
            let alreadyClicked = [], alreadyHoverd = [];
            let lastEvent, lastMouseEnter;
            for(let key in session){
                let event = session[key];
                if(event.type == eventTypes.mouseEnter) {
                    this.parsedData[event.id].hovers++;
                    if(!alreadyHoverd.includes(event.id)){
                        this.parsedData[event.id].hoverTimes.push(calculateTimeDifference(startTime, key));
                        alreadyHoverd.push(event.id);
                    }
                }
                else if(event.type == eventTypes.click){
                    this.parsedData[event.id].clicks++;
                    if(lastEvent.event.type == eventTypes.mouseEnter) {
                        this.parsedData[event.id].hoverAndClick++;
                        this.parsedData[event.id].hoverToClickTimes.push(calculateTimeDifference(lastEvent.timestamp, key));
                        if(!alreadyClicked.includes(event.id)){
                            this.parsedData[event.id].clickTimes.push(calculateTimeDifference(startTime, key));
                            this.parsedData[event.id].visitorClicks++
                            alreadyClicked.push(event.id);
                        }
                    }
                }
                else if(event.type == eventTypes.mouseLeave){
                    this.parsedData[event.id].hoverDurTimes.push(calculateTimeDifference(lastMouseEnter.timestamp, key));
                }else if(event.type == 0) startTime = key;

                lastEvent = {event:session[key], timestamp:key};
                lastMouseEnter = event.type == eventTypes.mouseEnter ? {event:session[key], timestamp:key} : lastMouseEnter;
            }
        }
    }

    _organizeEvents(){
        function getMovementSpeed(movementEvent) {
            function calculateDistance(x1, y1, x2 ,y2){
                return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            }

            function calculateMovementDistance(movement1, movement2) {
                return calculateDistance(movement1.x, movement1.y, movement2.x, movement2.y);
            }

            function getMoveTime(event, movement) {
                return movement.timeOffset == undefined ? movement.timestamp : event.timestamp + movement.timeOffset;
            }

            let positions = movementEvent.data.positions;
            let distanceSum = Stats.sum(positions, (n1, n2) => {
                if (n2 != undefined) return calculateMovementDistance(n1, n2);
                else return 0;
            });

            let date1 = getMoveTime(movementEvent, positions[0]);
            let date2 = getMoveTime(movementEvent, positions[positions.length - 1]);
            return positions.length > 1 ? {
                speed: Math.round(distanceSum / calculateTimeDifference(date1, date2)),
                start: date1,
                end: date2
            } : {speed:0, start:0, end:0};
        }

      //  let speeds = [];
        for(let si = 0, session = this.config.sessions[si]; si < this.config.sessions.length; si++, session = this.config.sessions[si]){
            let curData = this.organizedEvents[si];
            curData[session[3].timestamp] = {type:eventTypes.documentLoad};
            let lastHover = {id:-1, timestamp:-1};
            let lastMovement = null;
            let tempMove = [];
            let sessionMoves = [];
            for(let i = 4, event = session[4]; i < session.length; i++, event = session[i]){
                if(event.data.source == IncrementalSource.MouseInteraction && event.data.type == MouseInteractions.Click && this.leaves.includes(event.data.id)) {curData[event.timestamp] = {id:event.data.id, type:eventTypes.click};}
                else if(event.data.source == IncrementalSource.MouseMove){
                    event.data.positions.forEach(pos => {
                        if(lastHover.id != pos.id){
                            if(this.leaves.includes(lastHover.id)) curData[event.timestamp + pos.timeOffset] = {id:lastHover.id, type:eventTypes.mouseLeave};
                            if(this.leaves.includes(pos.id)) curData[ curData[event.timestamp + pos.timeOffset] ? event.timestamp + pos.timeOffset : event.timestamp + pos.timeOffset] = {id:pos.id, type:eventTypes.mouseEnter};
                            lastHover.id = pos.id;
                            lastHover.timestamp = event.timestamp + pos.timeOffset;
                        }
                    });
                    if (lastMovement != null){
                        let result = getMovementSpeed(event);
                        if(result.speed) tempMove.push(result);
                    } 
                    lastMovement = event;
                }
                if(event.data.source == IncrementalSource.MouseInteraction){
                    if(tempMove.length > 0){ 
                        sessionMoves.push(tempMove); 
                        //speeds.push(...tempMove)
                    }
                    tempMove = [];
                }
            }
            this.movementSpeeds.push(sessionMoves.length ? sessionMoves : [tempMove]);
            //if(!sessionMoves.length) speeds.push(...tempMove);
            this.organizedEvents[si] = sortObject(this.organizedEvents[si]);
            /*this.temp["mean"] = Stats.mean(speeds, e => e.speed);
            this.temp["std"] = Stats.standardDeviation(speeds, null, e => e.speed);
            this.thrashing = this.movementSpeeds.map(e => e.map(a => Stats.mean(a, a=>a.speed) > Stats.mean(speeds, e => e.speed)).includes(true))*/
        }
    }

    _findLeaves(){
        let leaves = [];
        let _this = this;

        function areChildrenOnlyTextNodes(node){
            for(let index in node.childNodes) if(node.childNodes[index].tagName) return false;
            return true;
        }
    
        function findLeavesRecursive(node){
            if(node.childNodes && node.childNodes.length > 0 && !areChildrenOnlyTextNodes(node)) node.childNodes.forEach( e => findLeavesRecursive(e));
            else if(node.tagName && _this.config.leafTypes.includes(node.tagName)) leaves.push(node.id);
        }
    
        findLeavesRecursive(this.snapshot);
        return leaves;
    }



    get getLeaves(){
        return this.leaves;
    }

    get hoverToClickRate(){
        return this._calculateOverLeaves(leaf => +(this.parsedData[leaf].hoverAndClick / this.parsedData[leaf].hovers * 100).toPrecision(2));
    }

    get visitorClickRate(){
        return this._calculateOverLeaves(leaf => +(this.parsedData[leaf].visitorClicks / this.config.sessions.length * 100).toPrecision(2));
    }

    get timeBeforeClick() {
        return this._calculateOverLeaves(leaf => +(Stats.mean(this.parsedData[leaf].clickTimes)).toPrecision(2));
    }

    get timeBeforeHover() {
        return this._calculateOverLeaves(leaf => +(Stats.mean(this.parsedData[leaf].hoverTimes)).toPrecision(2));
    }

    get hoverToClickTime() {
        return this._calculateOverLeaves(leaf => +(Stats.mean(this.parsedData[leaf].hoverToClickTimes)).toPrecision(2));
    }

    get averageHoverTime() {
        return this._calculateOverLeaves(leaf => +(Stats.mean(this.parsedData[leaf].hoverDurTimes)).toPrecision(2));
    }

    get getParsedData(){
        return this.parsedData;
    }

    get getCalculatedData(){
        let array = [
            this.visitorClickRate,
            this.averageHoverTime,
            this.hoverToClickRate,
            this.hoverToClickTime,
            this.timeBeforeClick,
            this.timeBeforeHover
        ];

        let returnObj = {};

        this.leaves.forEach(leaf => {
            returnObj[leaf] = {
                visitorClickRate: array[0][leaf],
                averageHoverTime: array[1][leaf],
                hoverToClickRate: array[2][leaf],
                hoverToClickTime: array[3][leaf],
                timeBeforeClick: array[4][leaf],
                timeBeforeHover: array[5][leaf]
            };
        })

        
        return returnObj;
    }

    getElementData(id){
        if(!this.leaves.includes(id)) throw new Error("Unknown leaf ID");
        return {
            ...this.parsedData[id],
            averageHoverTime: +(Stats.mean(this.parsedData[id].hoverDurTimes)).toPrecision(2),
            visitorClickRate: +(this.parsedData[id].visitorClicks / this.config.sessions.length * 100).toPrecision(2),
            hoverToClickRate: +(this.parsedData[id].hoverAndClick / this.parsedData[id].hovers * 100).toPrecision(2),
            hoverToClickTime: +(Stats.mean(this.parsedData[id].hoverToClickTimes)).toPrecision(2),
            timeBeforeClick: +(Stats.mean(this.parsedData[id].clickTimes)).toPrecision(2),
            timeBeforeHover: +(Stats.mean(this.parsedData[id].hoverTimes)).toPrecision(2)
        };
    }

    get getSnapshot(){
        return this.snapshot;
    }

    get speeds(){
        return this.movementSpeeds;
    }
};

export {rrwebDataMiner, eventTypes};