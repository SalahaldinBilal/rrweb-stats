import { DataParser, eventTypes } from '../../datapraser/dataparser.js';


/*function flattenMatrix(sessions){
    let flattenedEvents = [];
    sessions.forEach(session => flattenedEvents.push(...session));
    return flattenedEvents;
}

function calculateTimeDifference(date1, date2){
    return (date2 - date1) /1000;
}

function calculateDistance(x1, y1, x2 ,y2){
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function calculateSpeed(movements, lastPoint){
    let sum = {x:0, y:0};
    for(let movement of movements){
        sum.x += movement.x;
        sum.y += movement.y;
    }

    let avg = {x:Math.round(sum.x / movements.length), y:Math.round(sum.y / movements.length)};
    let speed = lastPoint == undefined ? 0 : Math.round(calculateDistance(lastPoint.x, lastPoint.y, avg.x, avg.y) / 0.5);
    
    return {...avg, speed:speed}
}

function calculateStd(values, mean, n){
    let sum = 0;
    for(let value of values) sum += Math.pow(value - mean, 2);
    return Math.sqrt(sum / n-1);
}

var moves = [];

function thrashing(events, number, speedThreshhold, std, mean){
    moves = [];
    let prevMoves = [];
    let meanSum = 0;
    for(let si = 0, session = events[si]; si < events.length; si++, session = events[si]){
        let lastStop = {x:0, y:0}
        for(let i = 4, event = session[4]; i < session.length; i++, event = session[i]){
            if(event.data.source == 1) {
                let e = calculateSpeed(event.data.positions, lastStop);
                prevMoves.push(e);
                meanSum += e.speed;
                lastStop = {x:e.x, y:e.y};
            }else if(event.data.source == 1 && event.data.type == 2){
                lastStop = {x:event.data.x, y:event.data.y};
            }
        }
        prevMoves.sort((a, b) => a.speed-b.speed );
        let mean = speedSum/prevMoves.length;
        moves.push({moves:prevMoves, speedAvg:mean, std:calculateStd(prevMoves.map(e => { return e.speed }), mean, prevMoves.length), median:prevMoves[Math.round(prevMoves.length /2)].speed});
    }
    let sampleMean = meanSum/prevMoves.length;
    let stdSum = 0;
    for(let event of prevMoves) stdSum+= Math.abs(event.speed - sampleMean);
    let sampleStd = stdSum/(prevMoves.length-1);
    console.log(sampleMean, sampleStd);
    console.log(prevMoves);
    let flag = 0;
    let mouseMoves = [];
    for(let si = 0, session = events[si]; si < events.length; si++, session = events[si]){
        for(let i = 4, event = session[4]; i < session.length; i++, event = session[i]){
            if(event.data.source == 1) {
                let e = calculateSpeed(event.data.positions, prevMoves.length > 0 ? prevMoves[prevMoves.length -1] : undefined);
                flag++;

            }
        }
    }
    


    let ev = flattenEvents(moves.map(a => a.moves.map(e => e.speed)));
    let gm = ev.sum() / ev.length;
    let st = calculateStd(ev,gm,ev.length);
    console.log(gm, st);


}*/

var dp;
fetch("/src/data/recordings.json")
    .then(response => response.json())
    .then(json => {
        dp = new DataParser({sessions:json});
        console.log(dp.getParsedData, dp.getCalculatedData, dp.getSnapshot, eventTypes);
    })
    //code was run on a local server using local-server package in node