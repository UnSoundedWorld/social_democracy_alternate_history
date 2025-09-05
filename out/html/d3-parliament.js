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
        "click", "dblclick", "mousedown", "mouseenter",
        "mouseleave", "mousemove", "mouseout", "mouseover",
        "mouseup", "touchcancel", "touchend", "touchmove", "touchstart"
    );

    function parliamentFunc(data) {
        data.each(function(d) {
            width = width || this.getBoundingClientRect().width;
            height = width ? width / 2 : this.getBoundingClientRect().width / 2;

            var outerR = Math.min(width/2, height);
            var innerR = outerR * innerRadiusCoef;

            var svg = d3.select(this);

            // -----------------------------
            // Compute rows and seats
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
                var seatsInRow = Math.floor(Math.PI*(b+i)) - Math.floor(seatsToRemove/nRows) - (seatsToRemove%nRows > i ? 1:0);
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
            // Assign party seats outer-to-inner
            // -----------------------------
            console.log("Raw party data:", d);

            // Ensure total seats is exactly 460
            let totalRequested = d.reduce((sum,p)=>sum+p.seats,0);
            let scaledSeats = d.map(p => ({
                ...p,
                _scaledSeats: Math.floor(p.seats * 460 / totalRequested)
            }));

            let assigned = scaledSeats.reduce((sum,p)=>sum+p._scaledSeats,0);
            let leftover = 460 - assigned;
            let iLeft = 0;
            while(leftover>0) {
                scaledSeats[iLeft % scaledSeats.length]._scaledSeats++;
                leftover--;
                iLeft++;
            }

            // -----------------------------
            // Assign seats in order along semicircle
            // Outermost row first, then inward
            // -----------------------------
            let rowMap = [];
            let idx = 0;
            for(let row = nRows-1; row>=0; row--){  // outermost row first
                let rowSeats = seatsArr.filter(s => Math.round((s.polar.r - innerR)/rowWidth) === row);
                rowMap.push(rowSeats);
            }

            let partyOrder = ["raz","lew","po","pol","psl","pis","konf"];
            let partySeatsMap = {};
            partyOrder.forEach(p => {
                let party = scaledSeats.find(x=>x.id===p);
                if(party) partySeatsMap[p]=party._scaledSeats;
            });

            let seatCounter = 0;
            rowMap.forEach(rowSeats=>{
                let totalRowSeats = rowSeats.length;
                let rowAssigned = [];
                let partyIndex = 0;
                let remainingSeats = totalRowSeats;
                let partyKeys = partyOrder.filter(k=>partySeatsMap[k]>0);
                while(rowAssigned.length < totalRowSeats){
                    partyKeys.forEach(pk=>{
                        if(partySeatsMap[pk]>0 && rowAssigned.length < totalRowSeats){
                            rowAssigned.push(pk);
                            partySeatsMap[pk]--;
                        }
                    });
                }
                // assign parties to seats in row left to right
                for(let s=0;s<rowSeats.length;s++){
                    let seat = rowSeats[s];
                    let pk = rowAssigned[s];
                    let party = scaledSeats.find(x=>x.id===pk);
                    seat.party = party;
                }
            });

            console.log("Seats assigned:", seatsArr);

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
                .attr("cx",enter.fromCenter?0:d=>d.cartesian.x)
                .attr("cy",enter.fromCenter?0:d=>d.cartesian.y)
                .attr("r",enter.smallToBig?0:rowWidth*0.4)
                .attr("fill",d=>d.party.color||"#999")
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
                    .attr("fill",d=>d.party.color||"#999");
            } else {
                circles.attr("cx",d=>d.cartesian.x)
                       .attr("cy",d=>d.cartesian.y)
                       .attr("r",rowWidth*0.4)
                       .attr("fill",d=>d.party.color||"#999");
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
