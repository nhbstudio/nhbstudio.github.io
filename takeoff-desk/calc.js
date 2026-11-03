// The formulas are the product's own TRADES object, copied at build time so the free pages and the paid file agree.
const up=n=>Math.ceil(n-1e-9);
const rd=(n,d=2)=>Math.round(n*Math.pow(10,d))/Math.pow(10,d);
const bk=m=>({mult:m==="Concrete, ready-mix"?0.5:1,min:1});
function orderQty(qty,mult,min){let q=qty;if(mult>0)q=Math.ceil(q/mult-1e-9)*mult;if(min>0&&q<min)q=min;return rd(q,4);}
const UNITS={"Concrete, ready-mix": "yd", "Concrete, 80lb bag": "bag", "Rebar #4, 20ft": "stick", "Wire mesh 5x150": "roll", "Drywall 4x8 1/2in": "sheet", "Drywall 4x12 1/2in": "sheet", "Joint compound": "gal", "Drywall tape 500ft": "roll", "Drywall screws": "lb", "Interior paint": "gal", "Primer": "gal", "Epoxy base, 100% solids": "gal", "Epoxy topcoat": "gal", "Color flake": "lb", "Crushed stone": "ton", "Mulch, bulk": "yd", "Sod": "pallet", "Pavers": "ea", "Paver base": "ton", "Bedding sand": "ton", "Tile": "sf", "Thinset 50lb": "bag", "Batt insulation R13": "bag", "Shingles": "bundle", "Synthetic underlayment roll": "roll", "Fence post 4x4x8": "ea", "Fence rail 2x4x8": "ea", "Fence picket": "ea", "Dumpster / disposal": "job", "New material": "ea"};
const TRADES = {
 concrete:{
  name:"Concrete slab", waste:8, wasteNote:"8-10% typical on flatwork",
  fields:[["L","Length (ft)",20],["W","Width (ft)",20],["D","Thickness (in)",4],["reb","Rebar grid (in, 0 = none)",18],["shrt","Short-load threshold (yd)",7]],
  run(v,w){
   const cuft=v.L*v.W*(v.D/12), yd=cuft/27, ydw=yd*w;
   const lines=[{d:"Concrete, ready-mix", q:ydw, mat:"Concrete, ready-mix", task:"Concrete place & finish", taskQty:v.L*v.W}];
   let sticks=0;
   if(v.reb>0){
    const a=up(v.W/(v.reb/12))+1, b=up(v.L/(v.reb/12))+1;
    sticks=(a*v.L+b*v.W)/20*w;
    lines.push({d:"Rebar #4, 20ft", q:sticks, mat:"Rebar #4, 20ft"});
   }
   const ordered=orderQty(ydw, bk("Concrete, ready-mix").mult, bk("Concrete, ready-mix").min);
   const flags=[];
   if(v.shrt>0 && ordered<v.shrt) flags.push(
    "Under your "+v.shrt+" yard short-load threshold. Most plants bill a short-load fee below that, so "+ordered+" yd and "+v.shrt+" yd often cost within a few dollars of each other. Ask the plant before you order the smaller load.");
   return {lines, summary:[
     ["Area", rd(v.L*v.W,0)+" sf"],
     ["Neat volume", rd(cuft,1)+" cf / "+rd(yd,2)+" yd"],
     ["With "+rd((w-1)*100,1)+"% waste", rd(ydw,2)+" yd"],
     v.reb>0?["Rebar", rd(sticks,1)+" sticks"]:null
   ].filter(Boolean), flags,
   method:"<b>Volume</b> = length x width x thickness/12, divided by 27 for yards. Waste on flatwork covers subgrade variation and the bit left in the chute. <b>Rebar</b> assumes a two-way grid at your spacing on 20 ft sticks with no lap allowance, so add lap yourself if you tie long runs."};
 }},
 drywall:{
  name:"Drywall", waste:10, wasteNote:"10% on plain rooms, 15%+ with lots of cuts",
  fields:[["L","Room length (ft)",12],["W","Room width (ft)",14],["H","Wall height (ft)",8],["ceil","Ceiling? 1 = yes",1],["sheet","Sheet length (ft)",12],["ded","Deduct openings (sf)",0]],
  run(v,w){
   const wall=2*(v.L+v.W)*v.H, ceil=v.ceil?v.L*v.W:0;
   const scrPerSheet=(v.sheet==12?40:28)+(v.ceil?10:0);
   const net=Math.max(0,wall+ceil-v.ded), area=net*w;
   const sa=4*(v.sheet||8);
   const sheets=area/sa;
   const matName=v.sheet==12?"Drywall 4x12 1/2in":"Drywall 4x8 1/2in";
   const mud=area*0.010, tape=area*0.37/500, screws=(sheets*scrPerSheet)/238;
   return {lines:[
     {d:matName, q:sheets, mat:matName, task:"Drywall hang", taskQty:net},
     {d:"Joint compound", q:mud, mat:"Joint compound", task:"Drywall tape & finish", taskQty:net},
     {d:"Drywall tape 500ft", q:tape, mat:"Drywall tape 500ft"},
     {d:"Drywall screws", q:screws, mat:"Drywall screws"}
   ], summary:[
     ["Wall", rd(wall,0)+" sf"],
     v.ceil?["Ceiling", rd(ceil,0)+" sf"]:null,
     v.ded>0?["Less openings", "-"+rd(v.ded,0)+" sf"]:null,
     ["Net", rd(net,0)+" sf"],
     ["With waste", rd(area,0)+" sf"],
     ["Sheets", rd(sheets,1)+" x 4'x"+v.sheet+"'"]
   ].filter(Boolean), flags:[],
   method:"<b>Walls</b> = perimeter x height. Not deducting openings under about 32 sf is a working convention rather than a published standard, and it partly substitutes for waste, so do not stack a large waste factor on top of it. <b>Compound</b> at 0.010 gal/sf and <b>tape</b> at 0.37 lf/sf, both from the USG Sheetrock data sheets (10 gal and 370 ft per 1,000 sf). <b>Screws</b> at 28 per 4x8 sheet or 40 per 4x12, plus 10 more per sheet on ceilings, at 238 per pound for #6 x 1-1/4 coarse."};
 }},
 paint:{
  name:"Paint", waste:5, wasteNote:"5% is plenty, paint does not get miscut",
  fields:[["L","Length (ft)",12],["W","Width (ft)",14],["H","Height (ft)",8],["coats","Finish coats",2],["prime","Primer coats",1],["cov","Spread rate (sf/gal)",350],["ded","Deduct openings (sf)",0]],
  run(v,w){
   const wall=Math.max(0,2*(v.L+v.W)*v.H-v.ded), a=wall*w;
   const cov=v.cov||350;
   const p=a*v.coats/cov, pr=a*v.prime/cov;
   const lines=[{d:"Interior paint, "+v.coats+" coats", q:p, mat:"Interior paint", task:"Paint, roll two coats", taskQty:wall}];
   if(v.prime>0) lines.push({d:"Primer, "+v.prime+" coat", q:pr, mat:"Primer"});
   return {lines, summary:[
     ["Wall area", rd(wall,0)+" sf"],
     ["Spread rate", cov+" sf/gal"],
     ["Finish", rd(p,2)+" gal"],
     v.prime>0?["Primer", rd(pr,2)+" gal"]:null
   ].filter(Boolean), flags:[],
   method:"<b>Gallons</b> = wall area x coats / spread rate. Spread rate is the number on the can under ideal conditions. Over new drywall or a rough surface the real rate runs lower, so drop it to 300 or 275 and see whether your last three jobs agree."};
 }},
 epoxy:{
  name:"Epoxy floor", waste:8, wasteNote:"8-12%, more on a rough or porous slab",
  fields:[["L","Length (ft)",24],["W","Width (ft)",24],["mils","Base coat (mils)",10],["solids","Solids %",100],["top","Topcoat (mils, 0 = none)",5],["flake","Flake coverage %",0]],
  run(v,w){
   const a=v.L*v.W;
   const cov=1604/(v.mils||10)*((v.solids||100)/100);
   const base=a*w/cov;
   const lines=[{d:"Epoxy base @ "+v.mils+" mils", q:base, mat:"Epoxy base, 100% solids", task:"Epoxy floor, prep+coat", taskQty:a}];
   let topG=0, flk=0;
   if(v.top>0){ const ct=1604/v.top*((v.solids||100)/100); topG=a*w/ct;
     lines.push({d:"Topcoat @ "+v.top+" mils", q:topG, mat:"Epoxy topcoat"}); }
   if(v.flake>0){ flk=a*(v.flake/100)*0.25*w;
     lines.push({d:"Color flake, "+v.flake+"% broadcast", q:flk, mat:"Color flake"}); }
   return {lines, summary:[
     ["Floor", a+" sf"],
     ["Coverage at "+v.mils+" mils", rd(cov,0)+" sf/gal"],
     ["Base", rd(base,2)+" gal"],
     v.top>0?["Topcoat", rd(topG,2)+" gal"]:null,
     v.flake>0?["Flake", rd(flk,1)+" lb"]:null
   ].filter(Boolean), flags:[],
   method:"<b>Theoretical coverage</b> = 1604 / mils, scaled by solids content. 1604 sf per gallon at 1 mil is the standard constant for a 100% solids coating. A porous or freshly ground slab drinks the first coat, so raise waste rather than lowering mils if you want the film thickness you quoted. <b>Flake</b> at full broadcast runs about 0.25 lb/sf and scales linearly below that."};
 }},
 gravel:{
  name:"Gravel / stone", waste:8, wasteNote:"8-10%, plus compaction below",
  fields:[["L","Length (ft)",20],["W","Width (ft)",30],["D","Compacted depth (in)",4],["comp","Compaction allowance %",23],["dens","Tons per loose yd",1.5]],
  run(v,w){
   const loose=(v.D*(1+v.comp/100))/12;
   const yd=v.L*v.W*loose/27*w, t=yd*(v.dens||1.4);
   return {lines:[{d:"Crushed stone", q:t, mat:"Crushed stone", task:"Spread gravel", taskQty:t}],
   summary:[
    ["Area", rd(v.L*v.W,0)+" sf"],
    ["Compacted depth", v.D+" in"],
    ["Loose depth needed", rd(loose*12,2)+" in"],
    ["Volume", rd(yd,2)+" yd"],
    ["Weight", rd(t,2)+" ton"]
   ], flags:[],
   method:"<b>Compaction</b> is the part most calculators skip. Aggregate loses roughly 15-25% of loose depth when it is plate-compacted, so ordering by finished depth leaves you short. This adds your allowance before converting. <b>Density</b> varies by material and moisture. These defaults compound to about 1.85 tons per compacted cubic yard, which matches the WisDOT conversion factor for in-place dense-graded base. Your quarry ticket is the real number, so overwrite it with theirs."};
 }},
 mulch:{
  name:"Mulch", waste:5, wasteNote:"5%, it is forgiving",
  fields:[["A","Bed area (sf)",500],["D","Depth (in)",3]],
  run(v,w){
   const cf=v.A*(v.D/12)*w, yd=cf/27, bags=cf/2;
   return {lines:[{d:"Mulch, bulk", q:yd, mat:"Mulch, bulk", task:"Spread mulch", taskQty:yd}],
   summary:[["Bed area", rd(v.A,0)+" sf"],["Volume", rd(cf,1)+" cf"],["Bulk", rd(yd,2)+" yd"],["Bagged equivalent", up(bags)+" x 2cf bags"]], flags:[],
   method:"<b>Volume</b> = area x depth/12. Bulk sells by the yard at 27 cf; bags are 2 cf. Bulk beats bagged on price above roughly 3 yards, and the delivery minimum is usually where that decision actually gets made."};
 }},
 sod:{
  name:"Sod", waste:8, wasteNote:"8% square yards, 12-15% with curves",
  fields:[["A","Area (sf)",5000],["pal","Sf per pallet",400]],
  run(v,w){
   const a=v.A*w, p=a/(v.pal||450);
   return {lines:[{d:"Sod", q:p, mat:"Sod", task:"Lay sod", taskQty:v.A}],
   summary:[["Area", rd(v.A,0)+" sf"],["With waste", rd(a,0)+" sf"],["Pallets", rd(p,2)]], flags:[],
   method:"<b>Pallets</b> = area / pallet coverage. Pallet size runs from about 400 sf on southern slab pallets up to 700 sf on northern large rolls and differs by farm, so confirm before you price it. Curved and broken-up beds cut worse than open lawn, which is why the waste factor moves so much on this one."};
 }},
 pavers:{
  name:"Pavers", waste:8, wasteNote:"5% running bond, 10-15% herringbone or diagonal",
  fields:[["L","Length (ft)",12],["W","Width (ft)",16],["pl","Paver length (in)",8],["pw","Paver width (in)",4],["base","Base depth (in)",6],["sand","Bedding sand (in)",1]],
  run(v,w){
   const a=v.L*v.W, per=(v.pl*v.pw)/144, cnt=a*w/per;
   const baseT=a*(v.base/12)/27*1.5, sandT=a*(v.sand/12)/27*1.4;
   return {lines:[
     {d:"Pavers "+v.pl+'x'+v.pw, q:cnt, mat:"Pavers", task:"Lay pavers", taskQty:a},
     {d:"Paver base", q:baseT, mat:"Paver base"},
     {d:"Bedding sand", q:sandT, mat:"Bedding sand"}
   ], summary:[
     ["Patio", a+" sf"],["Per paver", rd(per,3)+" sf"],
     ["Pavers", rd(cnt,0)],["Base", rd(baseT,2)+" ton"],["Sand", rd(sandT,2)+" ton"]
   ], flags:[],
   method:"<b>Count</b> = area / paver face area with waste applied. Pattern drives the waste factor more than anything else here: a running bond wastes little, herringbone and any 45-degree layout waste far more because every perimeter piece is a cut. <b>Base</b> at about 1.5 ton/yd compacted, <b>bedding sand</b> at about 1.4."};
 }},
 tile:{
  name:"Tile", waste:10, wasteNote:"10% straight lay, 15% diagonal or herringbone",
  fields:[["A","Area (sf)",120],["tl","Tile length (in)",12],["tw","Tile width (in)",12],["box","Sf per box",15]],
  run(v,w){
   const a=v.A*w, per=(v.tl*v.tw)/144, cnt=a/per, boxes=a/(v.box||15), thin=a/85;
   return {lines:[
     {d:"Tile "+v.tl+'x'+v.tw, q:a, mat:"Tile", task:"Set tile", taskQty:v.A},
     {d:"Thinset 50lb", q:thin, mat:"Thinset 50lb"}
   ], summary:[
     ["Field", rd(v.A,0)+" sf"],["With waste", rd(a,1)+" sf"],
     ["Pieces", rd(cnt,0)],["Boxes at "+(v.box||15)+" sf", up(boxes)],["Thinset", rd(thin,1)+" bags"]
   ], flags:[],
   method:"<b>Waste</b> is the whole argument on tile. 10% covers a straight lay in a square room. Diagonal and herringbone run 15% or more because every edge piece is a cut, and a job with a lot of jogs runs higher still. <b>Thinset</b> at 85 sf per 50 lb bag, the low end of the 80-95 manufacturer band because running out mid-floor is the expensive failure, with a 1/4 inch square-notch trowel; large format and a bigger notch use considerably more. Order full boxes and order the dye lot together."};
 }},
 insulation:{
  name:"Insulation, batt", waste:5, wasteNote:"5%",
  fields:[["A","Area (sf)",800],["bag","Sf per bag",106]],
  run(v,w){
   const a=v.A*w, bags=a/(v.bag||106);
   return {lines:[{d:"Batt insulation", q:bags, mat:"Batt insulation R13", task:"Install batt insulation", taskQty:v.A}],
   summary:[["Area", rd(v.A,0)+" sf"],["With waste", rd(a,0)+" sf"],["Bags", rd(bags,2)]], flags:[],
   method:"<b>Coverage</b> is printed on the bag and changes with R-value, stud spacing and whether it is faced. Overwrite the default with the number from the bag you actually buy."};
 }},
 roofing:{
  name:"Roofing", waste:10, wasteNote:"10% gable, 15-18% hip, more with valleys",
  fields:[["A","Footprint (sf)",2200],["pitch","Pitch multiplier",1.118],["bund","Bundles per square",3]],
  run(v,w){
   const a=v.A*(v.pitch||1)*w, sq=a/100;
   const bund=sq*(v.bund||3), und=a/1000;
   return {lines:[
     {d:"Shingles", q:bund, mat:"Shingles", task:"Install shingles", taskQty:sq},
     {d:"Synthetic underlayment roll", q:und, mat:"Synthetic underlayment roll"}
   ], summary:[
     ["Footprint", rd(v.A,0)+" sf"],["Pitch factor", v.pitch],
     ["Roof area with waste", rd(a,0)+" sf"],["Squares", rd(sq,2)],["Bundles", up(bund)],["Underlayment rolls", up(und)]
   ], flags:[],
   method:"<b>Squares</b> = roof area / 100, and roof area is footprint x pitch multiplier. Common multipliers: 4/12 is 1.054, 6/12 is 1.118, 8/12 is 1.202, 12/12 is 1.414. <b>Waste</b> is where hip roofs bite: every hip and valley is a cut, so a cut-up hip roof runs well above the 10% that covers a plain gable. Starter and ridge cap are separate line items, this does not include them."};
 }},
 fence:{
  name:"Fence", waste:6, wasteNote:"6% pickets, posts and rails are counted not estimated",
  fields:[["lf","Run (linear ft)",150],["sp","Post spacing (ft)",8],["H","Height (ft)",6],["pw","Picket width (in)",5.5],["gap","Gap between pickets (in)",0],["runs","Separate runs",1],["rails","Rails per section",3],["gates","Gates",1]],
  run(v,w){
   const sec=up(v.lf/(v.sp||8));
   const runs=Math.max(1,Math.round(v.runs||1));
   const posts=sec+runs+(v.gates||0);
   const rails=sec*(v.rails||3);
   const pitch=(v.pw||5.5)+(v.gap||0);
   const pick=v.lf*12/pitch*w;
   return {lines:[
     {d:"Fence post 4x4x8", q:posts, mat:"Fence post 4x4x8", task:"Build fence", taskQty:v.lf},
     {d:"Fence rail 2x4x8", q:rails, mat:"Fence rail 2x4x8"},
     {d:"Fence picket", q:pick, mat:"Fence picket"}
   ], summary:[
     ["Run", rd(v.lf,0)+" lf"],["Sections", sec],
     ["Posts", posts+" ("+runs+" run"+(runs>1?"s":"")+(v.gates?", "+v.gates+" gate":"")+")"],
     ["Rails", rails],["Pickets", rd(pick,0)]
   ], flags:[],
   method:"<b>Posts</b> = sections + one per separate run, plus one per gate for the latch side. An L-shaped yard is three runs, not one, and that is where most counts come up short. <b>Pickets</b> = run in inches divided by picket width plus gap. A nominal 6 inch dog-ear picket is 5.5 inches actual, so dividing by 6 leaves you about 9 percent short on every solid privacy fence. Concrete for post holes is not included, run the concrete takeoff separately."};
 }}
};
(function(){
  var t=TRADES[window.TRADE], root=document.getElementById("calc"), out=document.getElementById("out"); if(!t||!root||!out) return;
  var h='<div class="fields">';
  t.fields.forEach(function(f){h+='<div class="field"><label>'+f[1]+'</label><input type="number" step="any" data-k="'+f[0]+'" value="'+f[2]+'"></div>';});
  h+='<div class="field"><label>Waste %</label><input type="number" step="any" data-k="__w" value="'+t.waste+'"></div></div>';
  h+='<p class="calc-note">'+t.wasteNote+'</p>';
  root.innerHTML=h;
  function calc(){
    var v={}; root.querySelectorAll("input[data-k]").forEach(function(i){v[i.dataset.k]=parseFloat(i.value)||0;});
    var r=t.run(v,1+v.__w/100);
    var o='<h2>Result</h2><table class="sum">'+r.summary.map(function(s){return '<tr><th>'+s[0]+'</th><td>'+s[1]+'</td></tr>';}).join("")+'</table>';
    o+='<h3>Order list</h3><ul class="lines">'+r.lines.map(function(l){var u=UNITS[l.mat]||"";return '<li><span>'+l.d+'</span><b>'+rd(l.q,2)+(u?" "+u:"")+'</b></li>';}).join("")+'</ul>';
    o+=r.flags.map(function(f){return '<p class="flag">'+f+'</p>';}).join("");
    o+='<h3>How it is figured</h3><p class="method">'+r.method+'</p>';
    out.innerHTML=o;
  }
  root.addEventListener("input",calc); calc();
})();
