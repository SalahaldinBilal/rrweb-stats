var sessions = [];
var wantedElementTypes = [
    "input",
    "button",
    "a"
]

function getSnapshotDetails(events){
    return {snapshot : events[3].data.node, dimensions:{width:events[2].data.width, height:events[2].data.height}};
}

function rebuildHtml(snapshot, document){
    return rrwebSnapshot.rebuild(snapshot, {doc:document})[1];
}

function findLeaves(snapshot, acceptedTypes){
    var leaves = [];

    function areChildrenOnlyTextNodes(node){
        for(index in node.childNodes) if(node.childNodes[index].tagName) return false;
        return true;
    }

    function findLeavesRecursive(node){
        if(node.childNodes && node.childNodes.length > 0 && !areChildrenOnlyTextNodes(node)) node.childNodes.forEach( e => findLeavesRecursive(e));
        else if(node.tagName && acceptedTypes.includes(node.tagName)) leaves.push(node.id);
    }

    findLeavesRecursive(snapshot);
    return leaves;
}

function flattenEvents(sessions){
    let flattenedEvents = [];
    sessions.forEach(session => flattenedEvents.push(...session));
    return flattenedEvents;
}

function calculateTimeDifference(date1, date2){
    return (date2 - date1) /1000;
}

function sortObject(object){
    return Object.keys(object).sort().reduce((r, k) => (r[k] = object[k], r), {});
}

const eventTypes = {};

(function(eventTypes){
    eventTypes[eventTypes["documentLoad"] = 0] = "documentLoad";
    eventTypes[eventTypes["mouseEnter"] = 1] = "mouseEnter";
    eventTypes[eventTypes["mouseLeave"] = 2] = "mouseLeave";
    eventTypes[eventTypes["click"] = 3] = "click";
})(eventTypes);

function organizeEvents(sessions, leaves){
    let orgData = Array(sessions.length).fill().map(() => ({}));
    for(let si = 0, session = sessions[si]; si < sessions.length; si++, session = sessions[si]){
        let curData = orgData[si];
        curData[session[3].timestamp] = {type:eventTypes.documentLoad};
        var lastHover = {id:-1, timestamp:-1};
        for(let i = 4, event = session[4]; i < session.length; i++, event = session[i]){
            //if(lastHover.id == 118) debugger;
            if(event.data.source == 2 && event.data.type == 2 && leaves.includes(event.data.id)) {curData[event.timestamp] = {id:event.data.id, type:eventTypes.click};}
            else if(event.data.source == 1){
                event.data.positions.forEach(pos => {
                    //if(lastHover.id == 118) debugger;
                    if(lastHover.id != pos.id){
                        if(leaves.includes(lastHover.id)) curData[event.timestamp + pos.timeOffset] = {id:lastHover.id, type:eventTypes.mouseLeave};
                        if(leaves.includes(pos.id)) curData[ curData[event.timestamp + pos.timeOffset] ? event.timestamp + pos.timeOffset : event.timestamp + pos.timeOffset] = {id:pos.id, type:eventTypes.mouseEnter};
                        lastHover.id = pos.id;
                        lastHover.timestamp = event.timestamp + pos.timeOffset;
                    }
                });
            } 
        }
        orgData[si] = sortObject(orgData[si]);
        //debugger;
    }
    return orgData;
}

Object.defineProperty(Array.prototype, "sum", {
    value: function(){ return this.reduce((a, b)=>{return a+b}, 0); }
});

var dataObj = {};
var tempDataObj = {};

fetch("/src/data/recordings.json")
    .then(response => response.json())
    .then(json => {
        sessions = json;
        console.log(sessions);
        let iframe = document.getElementsByTagName("iframe")[0];
        let snapshotDetails = getSnapshotDetails(sessions[0]);
        var leaves = findLeaves(snapshotDetails.snapshot, wantedElementTypes);

        iframe.width = snapshotDetails.dimensions.width;
        iframe.height = snapshotDetails.dimensions.height;
        let map = rebuildHtml(snapshotDetails.snapshot, iframe.contentDocument);
        
        leaves.forEach(leaf => {
            dataObj[leaf] = {clicks:0, hovers:0, hoverAndClick:0, visitorClicks:0, clickTimes:[], hoverTimes:[], hoverToClickTimes:[], hoverDurTimes:[]};
        })

        var oragnizedEvents = organizeEvents(sessions, leaves);
        for(let si = 0, session = oragnizedEvents[si]; si < Object.keys(oragnizedEvents).length; si++, session = oragnizedEvents[si]){
            let startTime;
            let alreadyClicked = [], alreadyHoverd = [];
            let lastEvent, lastMouseEnter;
            for(key in session){
                let event = session[key];
                if(event.type == eventTypes.mouseEnter) {
                    dataObj[event.id].hovers++;
                    if(!alreadyHoverd.includes(event.id)){
                        dataObj[event.id].hoverTimes.push(calculateTimeDifference(startTime, key));
                        alreadyHoverd.push(event.id);
                    }
                }
                else if(event.type == eventTypes.click){
                    //if(event.id == 118) debugger;
                    dataObj[event.id].clicks++;
                    if(lastEvent.event.type == eventTypes.mouseEnter) {
                        dataObj[event.id].hoverAndClick++;
                        dataObj[event.id].hoverToClickTimes.push(calculateTimeDifference(lastEvent.timestamp, key));
                        if(!alreadyClicked.includes(event.id)){
                            dataObj[event.id].clickTimes.push(calculateTimeDifference(startTime, key));
                            dataObj[event.id].visitorClicks++
                            alreadyClicked.push(event.id);
                        }
                    }
                }
                else if(event.type == eventTypes.mouseLeave){
                    dataObj[event.id].hoverDurTimes.push(calculateTimeDifference(lastMouseEnter.timestamp, key));
                }else if(event.type == 0) startTime = key;

                lastEvent = {event:session[key], timestamp:key};
                //if(event.id == 92) debugger;
                lastMouseEnter = event.type == eventTypes.mouseEnter ? {event:session[key], timestamp:key} : lastMouseEnter;
            }
        }

        leaves.forEach(leaf => {
            dataObj[leaf].hoverToClickRate = (dataObj[leaf].hoverAndClick / dataObj[leaf].hovers * 100).toFixed(2) + "%";
            dataObj[leaf].visitorClickRate = (dataObj[leaf].visitorClicks / sessions.length * 100).toFixed(2) + "%";
            dataObj[leaf].timeBeforeClick = (dataObj[leaf].clickTimes.sum() / dataObj[leaf].clickTimes.length).toFixed(2) + "s";
            dataObj[leaf].timeBeforeHover = (dataObj[leaf].hoverTimes.sum() / dataObj[leaf].hoverTimes.length).toFixed(2) + "s";
            dataObj[leaf].hoverToClickTime = (dataObj[leaf].hoverToClickTimes.sum() / dataObj[leaf].hoverToClickTimes.length).toFixed(2) + "s";
            dataObj[leaf].hoverTime = (dataObj[leaf].hoverDurTimes.sum() / dataObj[leaf].hoverDurTimes.length).toFixed(2) + "s";
            map[leaf].addEventListener("mouseenter", ()=>{console.table(dataObj[leaf], ["dataPoint", "value"]); console.log(leaf)});
        })
    })