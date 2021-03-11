import { rrwebDataMiner, eventTypes } from '/datapraser/rrwebDataMiner.js';
import { rebuild } from '/node_modules/rrweb-snapshot/es/rrweb-snapshot.js';

function displayData(data){
    let dataPoints = ["clicks", "hovers", "averageHoverTime", "visitorClickRate", "hoverToClickRate", "hoverToClickTime", "timeBeforeClick", "timeBeforeHover"]
    for(let dataPoint of dataPoints){
        document.getElementById(dataPoint).children[1].innerText = data[dataPoint];
    }
}

var dp;
fetch("/src/data/recordings.json")
    .then(response => response.json())
    .then(json => {
        dp = new rrwebDataMiner(json);
        dp.calculateStatstics();
        let iframe = document.getElementsByTagName("iframe")[0];
        let map = rebuild(dp.getSnapshot, {doc:iframe.contentDocument})[1];
        let head = iframe.contentDocument.getElementsByTagName("head")[0];
        let css = document.createElement("style")
        css.innerText = ".showing-data:hover {outline: 1px dashed blue;}";
        head.append(css);
        for(let leaf of dp.getLeaves){
            map[leaf].addEventListener("mouseenter", () => {
                displayData(dp.getElementData(leaf));
                map[leaf].classList.add("showing-data");
            });
            map[leaf].addEventListener("mouseleave", () => {
                map[leaf].classList.remove("showing-data");
            });
        }     
        console.log(dp.getClickIntervals(0.5));
        console.log(dp.checkClickIntervals(0.5, 0.5));
    })
    //code was run on a local server using local-server package in node
var formsdp = new rrwebDataMiner();
fetch("/src/data/form-recordings.json")
    .then(response => response.json())
    .then(json => {
        formsdp.addSessions(json, false);
        for(const session of json)
            console.log(formsdp.findAbandonedForms(session));
    })