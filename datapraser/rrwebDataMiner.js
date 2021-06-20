import {IncrementalSource, MouseInteractions, EventType} from '/node_modules/rrweb/es/rrweb/src/types.js'
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

const intervalType = {};
(function(intervalType){
    intervalType[intervalType["rageClick"] = 0] = "rageClick";
    intervalType[intervalType["deadClick"] = 1] = "deadClick";
})(intervalType);

class rrwebDataMiner{
    constructor(sessions, leafTypes){
        
        this.sessions = [];

        if(sessions) this.addSessions(sessions, false);

        this.leafTypes = leafTypes || ["input", "button", "a"];
        
        this.leaves = null;
        this.parsedData = {}

    }

    _clearParsedData(){
        this.parsedData = {}

        this.leaves.forEach(leaf => {
            this.parsedData[leaf] = {clicks:0, hovers:0, hoverAndClick:0, visitorClicks:0, clickTimes:[], hoverTimes:[], hoverToClickTimes:[], hoverDurTimes:[]};
        })
    }

    _calculateOverLeaves(formula){
        let result = {};
        this.leaves.forEach(leaf => result[leaf] = formula(leaf));
        return result;
    }

    _parseSessionEvents(organizedSession){
        let startTime;
        let alreadyClicked = [], alreadyHoverd = [];
        let lastEvent, lastMouseEnter;
        for(let key in organizedSession){
            let event = organizedSession[key];
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
            lastEvent = {event:organizedSession[key], timestamp:key};
            lastMouseEnter = event.type == eventTypes.mouseEnter ? {event:organizedSession[key], timestamp:key} : lastMouseEnter;
        }
    }

    _parseSessionsEvents(organizedEvents){
        for(let si = 0, session = organizedEvents[si]; si < organizedEvents.length; si++, session = organizedEvents[si]){
            this._parseSessionEvents(session);
        }
    }

    _organizeSessionEvents(session){
        let organizedEvents = {};
        organizedEvents[session[3].timestamp] = {type:eventTypes.documentLoad};
        let lastHover = {id:-1, timestamp:-1}

        for(const event of session){
            if(event.data.source == IncrementalSource.MouseInteraction && event.data.type == MouseInteractions.Click && this.leaves.includes(event.data.id)) organizedEvents[event.timestamp] = {id:event.data.id, type:eventTypes.click};
            else if(event.data.source == IncrementalSource.MouseMove){
                event.data.positions.forEach(pos => {
                    if(lastHover.id != pos.id){
                        if(this.leaves.includes(lastHover.id)) organizedEvents[event.timestamp + pos.timeOffset] = {id:lastHover.id, type:eventTypes.mouseLeave};
                        if(this.leaves.includes(pos.id)) organizedEvents[ organizedEvents[event.timestamp + pos.timeOffset] ? event.timestamp + pos.timeOffset : event.timestamp + pos.timeOffset] = {id:pos.id, type:eventTypes.mouseEnter};
                        lastHover.id = pos.id;
                        lastHover.timestamp = event.timestamp + pos.timeOffset;
                    }
                });
            }
        }

        organizedEvents = sortObject(organizedEvents);

        return organizedEvents;
    }

    _organizeSessionsEvents(){
        let organizedSessionsEvents = [];
        for(const session of this.sessions) organizedSessionsEvents.push(this._organizeSessionEvents(session));
        return organizedSessionsEvents;
    }

    _findLeaves(){
        let leaves = [];
        let _this = this;

        function areChildrenOnlyTextNodes(node){
            for(const child of node.childNodes) if(child.tagName) return false;
            return true;
        }
    
        function findLeavesRecursive(node){
            if(node.childNodes && node.childNodes.length > 0 && !areChildrenOnlyTextNodes(node)) node.childNodes.forEach( e => findLeavesRecursive(e));
            else if(node.tagName && _this.leafTypes.includes(node.tagName)) leaves.push(node.id);
        }
    
        findLeavesRecursive(this.getSnapshot);
        return leaves;
    }

    _findForms(){
        let forms = {};

        function getFormChildren(form, node){
            form.add(node.id);
            if(node.childNodes) node.childNodes.forEach(child => getFormChildren(form, child));
        }

        function findFormsRecursive(node){
            if(node.tagName)
                if(node.tagName === "form") {
                    forms[node.id] = new Set()
                    getFormChildren(forms[node.id], node)
                }
                else node.childNodes.forEach(child => findFormsRecursive(child));
        }

        findFormsRecursive(this.getSnapshot.childNodes[1]);
        return forms;
    }

    _probabilityForEachClick(interval){
        let elementCount = {};
        let probablities = {};
        for(const clickEvent of interval){
            if(elementCount.hasOwnProperty(clickEvent.data.id)) elementCount[clickEvent.data.id]++;
            else{
                elementCount[clickEvent.data.id] = 0;
            }
        }
        
        for(const element in elementCount) probablities[element] = elementCount[element] / interval.length;
        return probablities;
    }

    isIntervalRageOrDeadClick(interval, threshold){
        return Stats.shannonEntropy(this._probabilityForEachClick(interval)) <= threshold ? intervalType.deadClick : intervalType.rageClick;
    }

    checkClickIntervals(entropyThreshold, clickThreshold = 0.5){
        return this.getClickIntervals(clickThreshold).map(e => e.map(a => this.isIntervalRageOrDeadClick(a, entropyThreshold)))
    }

    findAbandonedForms(session){
        if(!session) throw new Error("Please provide a correct session");

        let forms = this._findForms();
        let abandonedForms = {};

        for(const key in forms) abandonedForms[key] = true;

        function anyAbandoned(){
            for(const form in abandonedForms) 
                if(abandonedForms[form] === true) return true;
            return false; 
        }

        for(const event of session){
            if(event.type === EventType.IncrementalSnapshot && event.data.source !== IncrementalSource.MouseMove){
                for(const form in abandonedForms)
                    if(forms[form].has(event.data.id)) abandonedForms[form] = false;
                if(!anyAbandoned()) return abandonedForms;
            }
        }

        return abandonedForms;
    }

    getMovementIntervals(){
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

        let movementSpeeds = [];

        for(const session of this.sessions){
            let lastMovement = null;
            let tempMove = [];
            let sessionMoves = [];
            for(const event of session){
                if(event.data.source == IncrementalSource.MouseMove){
                    if (lastMovement != null){
                        let result = getMovementSpeed(event);
                        if(result.speed) tempMove.push(result);
                    } 
                    lastMovement = event;
                }
                if(event.data.source == IncrementalSource.MouseInteraction){
                    if(tempMove.length > 0){ 
                        sessionMoves.push(tempMove); 
                    }
                    tempMove = [];
                }
            }
            movementSpeeds.push(sessionMoves.length ? sessionMoves : [tempMove]);
        }

        return movementSpeeds;
    }

    getClickIntervals(timeThreshold = 0.5){
        let intervals = [];
        
        for(const session of this.sessions){
            let lastClick = null;
            let interval = [];
            intervals.push([]);
            
            for(const event of session){
                if(event.data.source == IncrementalSource.MouseInteraction && event.data.type == MouseInteractions.Click){
                    if(lastClick && calculateTimeDifference(lastClick.timestamp, event.timestamp) <= timeThreshold) {
                        if(interval.length === 0) interval.push(lastClick)
                        interval.push(event);
                        //lastClick = event;
                    }
                    else if(interval.length > 0){
                        intervals[intervals.length - 1].push(interval);
                        interval = [];
                    }
                    if(lastClick)
                    console.log(event, calculateTimeDifference(lastClick.timestamp, event.timestamp))
                    lastClick = event;
                }
            }

            if(interval.length > 0) intervals[intervals.length - 1].push(interval);
        }

        return intervals;
    }

    getThrashingInfoOfMovInterval(movements, winSize, threshold) {
        if(movements.length >= winSize){
            var maxTrashingProbability = -1;
            var thrashingPeriod = [];

            for(let i = 0; i < movements.length; ++i) {
                var sum = 0;
                for (let j = i; j < movements.length && j-i < winSize; j++) {
                    var relSpeed = movements[j].speed / threshold;
                    var sigmoid = 1 / (1 + Math.exp(-Math.pow(relSpeed, 3)));
                    sum += sigmoid;
                }
                var avgSigmoid = (sum / winSize);
                if(avgSigmoid > 0.6) thrashingPeriod.push(movements[i]);
                if(maxTrashingProbability < avgSigmoid) maxTrashingProbability = avgSigmoid;
            }
            return {"thrashingProbability": maxTrashingProbability, "thrashingPeriod": thrashingPeriod} ;
        }
        return {"thrashingProbability": 0, "thrashingPeriod": null};
    }

    getThrashingInfoOfSessionMovements(winSize, threshold){
        let sessions = this.getMovementIntervals();
        let sessionsThrashings = [];
        for(const session of sessions){
            let sessionThrashings = [];
            for(const movement of session){
                sessionThrashings.push(this.getThrashingInfoOfMovInterval(movement, winSize, threshold));
            }
            sessionsThrashings.push(sessionThrashings);
        }
        return sessionsThrashings;
    }

    addSession(session, updateStats = true){
        this.sessions.push(session);
        if(updateStats) this._parseSessionEvents(this._organizeSessionEvents(session));
    }

    addSessions(sessions, updateStats = true){
        for(const session of sessions){
            this.addSession(session, updateStats);
        }
    }

    calculateStatstics(){
        this.leaves = this._findLeaves();
        this._clearParsedData()
        this._parseSessionsEvents(this._organizeSessionsEvents(this.sessions));
    }

    get getLeaves(){
        return this.leaves;
    }

    get getParsedData(){
        return this.parsedData;
    }

    get getCalculatedData(){
        let returnObj = {};

        this.leaves.forEach(leaf => {
            returnObj[leaf] = this.getElementData(leaf);
        });
        
        return returnObj;
    }

    getElementData(id){
        if(!this.leaves.includes(id)) throw new Error("Unknown leaf ID");
        return {
            ...this.parsedData[id],
            averageHoverTime: +(Stats.mean(this.parsedData[id].hoverDurTimes)).toPrecision(2),
            visitorClickRate: +(this.parsedData[id].visitorClicks / this.sessions.length * 100).toPrecision(2),
            hoverToClickRate: +(this.parsedData[id].hoverAndClick / this.parsedData[id].hovers * 100).toPrecision(2),
            hoverToClickTime: +(Stats.mean(this.parsedData[id].hoverToClickTimes)).toPrecision(2),
            timeBeforeClick: +(Stats.mean(this.parsedData[id].clickTimes)).toPrecision(2),
            timeBeforeHover: +(Stats.mean(this.parsedData[id].hoverTimes)).toPrecision(2)
        };
    }

    get getSnapshot(){
        return this.sessions[0][3].data.node;
    }

    get speeds(){
        return this.movementSpeeds;
    }
};

export {rrwebDataMiner, eventTypes, intervalType};