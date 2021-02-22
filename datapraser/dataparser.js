import {IncrementalSource, MouseInteractions} from '/node_modules/rrweb/es/rrweb/src/types.js'
//replace it with relative place for the type.js from rrweb

function sortObject(object){
    return Object.keys(object).sort().reduce((r, k) => (r[k] = object[k], r), {});
}

function calculateTimeDifference(date1, date2){
    return (date2 - date1) /1000;
}

Object.defineProperty(Array.prototype, "sum", {
    value: function(){ return this.reduce((a, b)=>{return a+b}, 0); }
});

const eventTypes = {};

(function(eventTypes){
    eventTypes[eventTypes["documentLoad"] = 0] = "documentLoad";
    eventTypes[eventTypes["mouseEnter"] = 1] = "mouseEnter";
    eventTypes[eventTypes["mouseLeave"] = 2] = "mouseLeave";
    eventTypes[eventTypes["click"] = 3] = "click";
})(eventTypes);

class DataParser{
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
        this.leaves = this.findLeaves();
        this.organizedEvents = Array(this.config.sessions.length).fill().map(() => ({}));
        this.organizeEvents();
        this.parsedData = {}

        this.leaves.forEach(leaf => {
            this.parsedData[leaf] = {clicks:0, hovers:0, hoverAndClick:0, visitorClicks:0, clickTimes:[], hoverTimes:[], hoverToClickTimes:[], hoverDurTimes:[]};
        })
        
        this.parseEvents();
    }

    calculateOverLeaves(formula){
        let result = {};
        this.leaves.forEach(leaf => result[leaf] = formula(leaf));
        return result;
    }

    parseEvents(){
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

    organizeEvents(){
        for(let si = 0, session = this.config.sessions[si]; si < this.config.sessions.length; si++, session = this.config.sessions[si]){
            let curData = this.organizedEvents[si];
            curData[session[3].timestamp] = {type:eventTypes.documentLoad};
            let lastHover = {id:-1, timestamp:-1};
            for(let i = 4, event = session[4]; i < session.length; i++, event = session[i]){
                if(event.data.source == IncrementalSource.MouseInteraction && event.data.type == MouseInteractions.Click && this.leaves.includes(event.data.id)) {curData[event.timestamp] = {id:event.data.id, type:eventTypes.click};}
                else if(event.data.source == IncrementalSource.MouseMove){
                    console.log(event);
                    event.data.positions.forEach(pos => {
                        if(lastHover.id != pos.id){
                            if(this.leaves.includes(lastHover.id)) curData[event.timestamp + pos.timeOffset] = {id:lastHover.id, type:eventTypes.mouseLeave};
                            if(this.leaves.includes(pos.id)) curData[ curData[event.timestamp + pos.timeOffset] ? event.timestamp + pos.timeOffset : event.timestamp + pos.timeOffset] = {id:pos.id, type:eventTypes.mouseEnter};
                            lastHover.id = pos.id;
                            lastHover.timestamp = event.timestamp + pos.timeOffset;
                        }
                    });
                } 
            }
            this.organizedEvents[si] = sortObject(this.organizedEvents[si]);
        }
    }

    findLeaves(){
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
        return this.calculateOverLeaves(leaf => +(this.parsedData[leaf].hoverAndClick / this.parsedData[leaf].hovers * 100).toPrecision(2));
    }

    get visitorClickRate(){
        return this.calculateOverLeaves(leaf => +(this.parsedData[leaf].visitorClicks / this.config.sessions.length * 100).toPrecision(2));
    }

    get timeBeforeClick(){
        return this.calculateOverLeaves(leaf => +(this.parsedData[leaf].clickTimes.sum() / this.parsedData[leaf].clickTimes.length).toPrecision(2));
    }

    get timeBeforeHover(){
        return this.calculateOverLeaves(leaf => +(this.parsedData[leaf].hoverTimes.sum() / this.parsedData[leaf].hoverTimes.length).toPrecision(2));
    }

    get hoverToClickTime(){
        return this.calculateOverLeaves(leaf => +(this.parsedData[leaf].hoverToClickTimes.sum() / this.parsedData[leaf].hoverToClickTimes.length).toPrecision(2));
    }

    get averageHoverTime(){
        return this.calculateOverLeaves(leaf => +(this.parsedData[leaf].hoverDurTimes.sum() / this.parsedData[leaf].hoverDurTimes.length).toPrecision(2));
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

    get getSnapshot(){
        return this.snapshot;
    }
};

export {DataParser, eventTypes};