/*
 * MIT License
 * © Copyright 2016 - Geoffrey Brossard (me@geoffreybrossard.fr)
 */

d3.parliament = function() {
    var width, height, innerRadiusCoef = 0.4;
    var enter = { smallToBig: true, fromCenter: true },
        update = { animate: true },
        exit = { bigToSmall: true, toCenter: true };

    var dispatch = d3.dispatch(
        "click","dblclick","mousedown","mouseenter",
        "mouseleave","mousemove","mouseout","mouseover",
        "mouseup","touchcancel","touchend","touchmove","touchstart"
    );

    function parliamentFunc(selection) {
        selection.each(function(d) {
            var svg = d3.select(this);
            width = width || svg.node().getBoundingClientRect().width;
            height = width / 2;
            var outerR = Math.min(width/2, height);
            var innerR = outerR * innerRadiusCoef;

            // -----------------------------
            // Compute semicircle rows and seats
            // -----------------------------
            var totalSeats = 460;
            var nRows = 0, maxSeats = 0, b = 0.5;
            while(maxSeats < totalSeats) {
                nRows++;
                b += innerRadiusCoef / (1 - innerRadiusCoef);
                maxSeats = 0;
                for(var i=0;i<nRows;i++) maxSeats += Math.floor(Math.PI*(b+i));
            }

            var rowWidth = (outerR - innerR) / nRows;
            var seatsArr = [];
            var seatsToRemove = maxSeats - totalSeats;

            for(var i=0;i<nRows;i++){
                var rowRadius = innerR + rowWidth*(i+0.5);
                var seatsInRow = Math.floor(Math.PI*(b+i)) - Math.floor(seatsToRemove/nRows) - (seatsToRemove%nRows>i?1:0);
                var angleStep = Math.PI / seatsInRow;
                var tetaStart = -Math.PI;
                for(var j=0;j<seatsInRow;j++){
                    seatsArr.push({
                        polar: { r: rowRadius, teta: tetaStart + angleStep*(j+0.5) },
                        cartesian: { x: rowRadius*Math.cos(tetaStart + angleStep*(j+0.5)),
                                     y: rowRadius*Math.sin(tetaStart + angleStep*(j+0.5)) }
                    });
                }
            }

            // -----------------------------
            // Scale party seats to exactly 460
            // -----------------------------
            var totalRequested = d.reduce((sum,p)=>sum+p.seats,0);
            var scaledSeats = d.map(p => ({
                ...p,
                _scaledSeats: Math.floor(p.seats * 460 / totalRequested)
            }));
            var assigned = scaledSeats.reduce((sum,p)=>sum+p._scaledSeats,0);
            var leftover = 460 - assigned;
            for(var i=0;i<leftover;i++){
                scaledSeats[i % scaledSeats.length]._scaledSeats++;
            }

            // -----------------------------
            // Assign seats along semicircle left-to-right
            // Outermost seats on edges, inner seats in between
            // -----------------------------
            var rowMap = [];
            for(var row=nRows-1; row>=0; row--){
                var rowSeats = seatsArr.filter(s => Math.round((s.polar.r - innerR)/rowWidth) === row);
                rowMap.push(rowSeats);
            }

            var partyOrder = ["raz","lew","po","pol","psl","pis","konf"];
            var partySeatsMap = {};
            partyOrder.forEach(p => {
                var party = scaledSeats.find(x=>x.id===p);
                if(party) partySeatsMap[p] = party._scaledSeats;
            });

            rowMap.forEach(rowSeats=>{
                var totalRowSeats = rowSeats.length;
                var rowAssigned = [];
                var partyKeys = partyOrder.filter(k=>partySeatsMap[k]>0);
                while(rowAssigned.length < totalRowSeats){
                    partyKeys.forEach(pk=>{
                        if(partySeatsMap[pk]>0 && rowAssigned.length < totalRowSeats){
                            rowAssigned.push(pk);
                            partySeatsMap[pk]--;
                        }
                    });
                    partyKeys = partyOrder.filter(k=>partySeatsMap[k]>0);
                }

                // Assign parties left to right along semicircle
                for(var s=0;s<rowSeats.length;s++){
                    var seat = rowSeats[s];
                    var pk = rowAssigned[s];
                    var party = scaledSeats.find(x=>x.id===pk);
                    seat.party = party;
                }
            });

            // -----------------------------
            // Draw seats
            // -----------------------------
            var container = svg.select(".parliament");
            if(container.empty()) container = svg.append("g").classed("parliament",true);
            container.attr("transform","translate("+width/2+","+outerR+")");

            var circles = container.selectAll(".seat").data(seatsArr);
            circles.attr("class","seat");

            var circlesEnter = circles.enter().append("circle")
                .attr("class","seat")
                .attr("cx", enter.fromCenter?0:d=>d.cartesian.x)
                .attr("cy", enter.fromCenter?0:d=>d.cartesian.y)
                .attr("r", enter.smallToBig?0:rowWidth*0.4)
                .attr("fill", d=>d.party?.color||"#999")
                .attr("stroke","#333");

            if(enter.fromCenter || enter.smallToBig){
                var t = circlesEnter.transition().duration(1000);
                if(enter.fromCenter) t.attr("cx",d=>d.cartesian.x).attr("cy",d=>d.cartesian.y);
                if(enter.smallToBig) t.attr("r",rowWidth*0.4);
            }

            for(var evt in dispatch._){
                (function(evt){ circlesEnter.on(evt,function(e){ dispatch.call(evt,this,e); }); })(evt);
            }

            if(update.animate){
                circles.transition().duration(1000)
                    .attr("cx",d=>d.cartesian.x)
                    .attr("cy",d=>d.cartesian.y)
                    .attr("r",rowWidth*0.4)
                    .attr("fill",d=>d.party?.color||"#999");
            } else {
                circles.attr("cx",d=>d.cartesian.x)
                       .attr("cy",d=>d.cartesian.y)
                       .attr("r",rowWidth*0.4)
                       .attr("fill",d=>d.party?.color||"#999");
            }

            if(exit.toCenter || exit.bigToSmall){
                circles.exit().transition().duration(1000)
                    .attr("cx",0).attr("cy",0)
                    .attr("r",0).remove();
            } else circles.exit().remove();
        });
    }

    parliamentFunc.width = function(v){ if(!arguments.length) return width; width=v; return parliamentFunc; };
    parliamentFunc.height = function(v){ if(!arguments.length) return height; return parliamentFunc; };
    parliamentFunc.innerRadiusCoef = function(v){ if(!arguments.length) return innerRadiusCoef; innerRadiusCoef=v; return parliamentFunc; };
    parliamentFunc.enter = { 
        smallToBig(v){ if(!arguments.length) return enter.smallToBig; enter.smallToBig=v; return parliamentFunc.enter; },
        fromCenter(v){ if(!arguments.length) return enter.fromCenter; enter.fromCenter=v; return parliamentFunc.enter; }
    };
    parliamentFunc.update = { animate(v){ if(!arguments.length) return update.animate; update.animate=v; return parliamentFunc.update; } };
    parliamentFunc.exit = { 
        bigToSmall(v){ if(!arguments.length) return exit.bigToSmall; exit.bigToSmall=v; return parliamentFunc.exit; },
        toCenter(v){ if(!arguments.length) return exit.toCenter; exit.toCenter=v; return parliamentFunc.exit; }
    };
    parliamentFunc.on = function(type,callback){ dispatch.on(type,callback); };

    return parliamentFunc;
};
