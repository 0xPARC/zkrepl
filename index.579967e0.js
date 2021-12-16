import{l as p,R as k,w as x,a as e,e as S,K as b,b as y,_ as N,c as A}from"./vendor.bfb6eff5.js";const C=function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))c(t);new MutationObserver(t=>{for(const n of t)if(n.type==="childList")for(const u of n.addedNodes)u.tagName==="LINK"&&u.rel==="modulepreload"&&c(u)}).observe(document,{childList:!0,subtree:!0});function f(t){const n={};return t.integrity&&(n.integrity=t.integrity),t.referrerpolicy&&(n.referrerPolicy=t.referrerpolicy),t.crossorigin==="use-credentials"?n.credentials="include":t.crossorigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function c(t){if(t.ep)return;t.ep=!0;const n=f(t);fetch(t.href,n)}};C();p.register({id:"circom"});let w=d=>{};p.registerHoverProvider("circom",{provideHover:async function(d,a){if(E.running)return null;const f=d.getLineContent(a.lineNumber),c=/([a-z$_][a-z0-9$_]*)(\.[a-z$_][a-z0-9$_]*)*(\[\d+\])?/g,t=a.column;let n;for(;(n=c.exec(f))&&!(n.index>t);){if(n.index+n[0].length<t)continue;const u=n[0],r=await new Promise(m=>{w=g=>{m(g.text),w=()=>{}},E.postMessage({type:"hover",symbol:u})});return{range:new k(a.lineNumber,1+n.index,a.lineNumber,1+n.index+n[0].length),contents:[{value:r}]}}return null}});p.setLanguageConfiguration("circom",{wordPattern:/(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,comments:{lineComment:"//",blockComment:["/*","*/"]},brackets:[["{","}"],["[","]"],["(",")"]],onEnterRules:[{beforeText:/^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,afterText:/^\s*\*\/$/,action:{indentAction:p.IndentAction.IndentOutdent,appendText:" * "}},{beforeText:/^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,action:{indentAction:p.IndentAction.None,appendText:" * "}},{beforeText:/^(\t|(\ \ ))*\ \*(\ ([^\*]|\*(?!\/))*)?$/,action:{indentAction:p.IndentAction.None,appendText:"* "}},{beforeText:/^(\t|(\ \ ))*\ \*\/\s*$/,action:{indentAction:p.IndentAction.None,removeText:1}}],autoClosingPairs:[{open:"{",close:"}"},{open:"[",close:"]"},{open:"(",close:")"},{open:'"',close:'"',notIn:["string"]},{open:"'",close:"'",notIn:["string","comment"]},{open:"`",close:"`",notIn:["string","comment"]},{open:"/**",close:" */",notIn:["string"]}],folding:{markers:{start:new RegExp("^\\s*//\\s*#?region\\b"),end:new RegExp("^\\s*//\\s*#?endregion\\b")}}});p.setMonarchTokensProvider("circom",{keywords:["signal","input","output","public","template","component","var","function","return","if","else","for","while","do","log","assert","include","pragma"],typeKeywords:["input","output","public"],operators:["!","~","-","||","&&","==","!=","<",">","<=",">=","|","&","<<",">>","+","-","*","/","\\","%","**","^","=","<--","<=="],escapes:/\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,tokenizer:{root:[[/[a-z_$][\w$]*/,{cases:{"@typeKeywords":"keyword","@keywords":"keyword","@default":"identifier"}}],[/[A-Z][\w\$]*/,"type.identifier"],{include:"@whitespace"},[/[{}()\[\]]/,"@brackets"],[/@\s*[a-zA-Z_\$][\w\$]*/,{token:"annotation",log:"annotation token: $0"}],[/\d*\.\d+([eE][\-+]?\d+)?/,"number.float"],[/0[xX][0-9a-fA-F]+/,"number.hex"],[/\d+/,"number"],[/[;,.]/,"delimiter"],[/"([^"\\]|\\.)*$/,"string.invalid"],[/"/,{token:"string.quote",bracket:"@open",next:"@string"}],[/'[^\\']'/,"string"],[/(')(@escapes)(')/,["string","string.escape","string"]],[/'/,"string.invalid"]],comment:[[/[^\/*]+/,"comment"],[/\/\*/,"comment","@push"],["\\*/","comment","@pop"],[/[\/*]/,"comment"]],string:[[/[^\\"]+/,"string"],[/@escapes/,"string.escape"],[/\\./,"string.escape.invalid"],[/"/,{token:"string.quote",bracket:"@close",next:"@pop"}]],whitespace:[[/[ \t\r\n]+/,"white"],[/\/\*/,"comment","@comment"],[/\/\/.*$/,"comment"]]}});var I=`pragma circom 2.0.1;

include "circomlib/poseidon.circom";

template Example () {
    signal input a;
    signal input b;
    signal output c;
    
    c <== a * b;

    assert(a > 2);
    
    component hash = Poseidon(2);
    hash.inputs[0] <== a;
    hash.inputs[1] <== b;

    log(hash.out);
}

component main { public [ a ] } = Example();

/* INPUT = {
    "a": "5",
    "b": "77"
} */`;function R(){return new Worker("worker.89d45173.js",{type:"module"})}var T="circomlib.acbc52cb.zip";console.log(T,x);var E;function $(){const[d,a]=e.useState(!1),[f,c]=e.useState([]),[t,n]=e.useState(null),u=e.useRef(null),r=e.useRef(null);return e.useEffect(()=>{if(u&&!t){const m=new URLSearchParams(location.search).get("code");m&&(history.replaceState(null,"","/"),fetch("https://kikks470wl.execute-api.us-west-1.amazonaws.com/access_token?code="+m,{method:"POST"}).then(o=>o.formData()).then(o=>{o.get("access_token")?(localStorage.GithubAccessToken=o.get("access_token"),i.getModel().setValue(localStorage.GithubNavigationCodeSnapshot),v()):alert("Failed to get access token")}));const g=new URLSearchParams(location.search).get("gist");g&&fetch("https://api.github.com/gists/"+g).then(o=>o.json()).then(o=>{var s,l;i.getModel().setValue(((l=(s=o==null?void 0:o.files)==null?void 0:s["main.circom"])==null?void 0:l.content)||"// Unable to load gist"),h()});const i=S.create(u.current,{value:g?"// Loading from Github...":I,language:"circom",theme:"vs",automaticLayout:!0,hover:{enabled:!0}}),h=()=>{(!r.current||r.current.running)&&(r.current&&(r.current.terminate(),r.current=null),r.current=new R,E=r.current,r.current.onmessage=o=>{const s=o.data;if(s.type==="fail")a(!1),r.current.running=!1;else if(s.type==="done")a(!1),r.current.running=!1;else{if(s.type==="hover")return w(s);s.type==="debug"&&console.log(s.text)}c(l=>[...l,s])},r.current.onerror=o=>{console.error(o),c(s=>[...s,{type:"error",text:o.message}])}),r.current.running=!0,a(Math.random()+1),c([]),r.current.postMessage({type:"run",code:i.getValue()})},v=()=>{const o=new URLSearchParams(location.search).get("gist"),s=()=>{localStorage.GithubNavigationCodeSnapshot=i.getValue(),location.href="https://github.com/login/oauth/authorize?client_id=85123c5a3a8a8f73f015&scope=gist"};localStorage.GithubAccessToken?(a(Math.random()+1),fetch(o?"https://api.github.com/gists/"+o:"https://api.github.com/gists",{method:"POST",body:JSON.stringify({files:{"main.circom":{content:i.getValue()}}}),headers:{Authorization:"token "+localStorage.GithubAccessToken}}).then(l=>l.json()).then(l=>{l.id?history.replaceState(null,"","/?gist="+l.id):l.message==="Bad credentials"?s():l.message==="Not Found"&&o&&(history.replaceState(null,"","/"),v()),a(!1)})):s()};i.addCommand(b.CtrlCmd|y.KeyS,v),i.addCommand(b.CtrlCmd|y.Enter,h),i.addCommand(b.Shift|y.Enter,h),i.addCommand(b.CtrlCmd|y.Period,function(){console.log("Abort kernel!"),a(!1),c(o=>[...o,{type:"abort",text:"Execution manually interrupted"}]),r.current&&(r.current.terminate(),r.current=null)}),g||h(),n(i)}return()=>t==null?void 0:t.dispose()},[u.current]),e.createElement("div",{className:"layout"},e.createElement("div",{className:"editor",ref:u}),e.createElement("div",{className:"sidebar"},e.createElement("div",{className:"output"},e.createElement("div",{className:"label"},"Shift-Enter to run. Cmd-S to save to Github Gists."),e.createElement("br",null),f.map((m,g)=>e.createElement("div",{key:g},e.createElement("div",{className:"label"},m.type,": "),e.createElement(N,null,m.text),m.files&&e.createElement("div",{className:"files"},Object.entries(m.files).map(([i,h])=>e.createElement("li",{key:i},e.createElement("a",{href:URL.createObjectURL(new Blob([h],{type:"application/octet-stream"})),download:i},i)," ","(",(h.length/1e3).toFixed(2),"KB)"))))),d?e.createElement(L,{key:d}):null)))}function L(){const[d,a]=e.useState(0);return e.useEffect(()=>{const f=Date.now(),c=setInterval(()=>{a(Date.now()-f)},16);return()=>clearInterval(c)},[]),e.createElement("div",{className:"loading"},e.createElement("div",{className:"lds-ellipsis"},e.createElement("div",null),e.createElement("div",null),e.createElement("div",null),e.createElement("div",null)),d>200&&e.createElement("div",{className:"time"},(d/1e3).toFixed(2),"s"))}A.createRoot(document.getElementById("root")).render(e.createElement($,null));
