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
            svg.selectAll("*").remove(); // clear previous

            // -----------------------------
            // Compute rows for 460-seat Sejm
            // -----------------------------
            var totalSeats = 460;
            var nRows = 0, maxSeats = 0, b = 0.5;
            while(maxSeats < totalSeats){
                nRows++;
                b += innerRadiusCoef/(1-innerRadiusCoef);
                maxSeats = 0;
                for(var i=0;i<nRows;i++) maxSeats += Math.floor(Math.PI*(b+i));
            }

            var rowWidth = (outerR - innerR)/nRows;
            var seatsArr = [];
            var seatsToRemove = maxSeats - totalSeats;

            // -----------------------------
            // Create semicircle seats (y positive downwards)
            // -----------------------------
            for(var i=0;i<nRows;i++){
                var rowRadius = innerR + rowWidth*(i+0.5);
                var seatsInRow = Math.floor(Math.PI*(b+i)) - Math.floor(seatsToRemove/nRows) - (seatsToRemove%nRows > i ? 1:0);
                var angleStep = Math.PI / seatsInRow;
                for(var j=0;j<seatsInRow;j++){
                    var teta = -Math.PI/2 + angleStep*(j + 0.5); // left-to-right
                    seatsArr.push({
                        polar: { r: rowRadius, teta: teta },
                        cartesian: { x: rowRadius*Math.cos(teta), y: rowRadius*Math.sin(teta) } // y positive down
                    });
                }
            }

            // -----------------------------
            // Assign parties (proportional)
            // -----------------------------
            let totalRequested = d.reduce((sum,p)=>sum+p.seats,0);
            let scaled = d.map(p=>({ ...p, _scaled: Math.floor(p.seats * totalSeats / totalRequested) }));

            let assigned = scaled.reduce((sum,p)=>sum+p._scaled,0);
            let leftover = totalSeats - assigned;
            let i = 0;
            while(leftover > 0){
                scaled[i % scaled.length]._scaled++;
                leftover--;
                i++;
            }

            // Assign seats
            let seatCounter = 0;
            scaled.forEach(party=>{
                for(let s=0; s<party._scaled; s++){
                    seatsArr[seatCounter].party = party;
                    seatCounter++;
                }
            });

            // -----------------------------
            // Draw seats
            // -----------------------------
            var container = svg.append("g").classed("parliament", true);
            container.attr("transform", "translate("+width/2+","+(outerR)+")"); // bottom-center

            container.selectAll(".seat").data(seatsArr)
                .enter().append("circle")
                .attr("class","seat")
                .attr("cx", d=>d.cartesian.x)
                .attr("cy", d=>d.cartesian.y)
                .attr("r", rowWidth*0.4)
                .attr("fill", d=>d.party.color || "#999")
                .attr("stroke", "#333");
        });
    }

    parliamentFunc.width = v=>{ if(!arguments.length) return width; width=v; return parliamentFunc; };
    parliamentFunc.height = v=>{ if(!arguments.length) return height; return parliamentFunc; };
    parliamentFunc.innerRadiusCoef = v=>{ if(!arguments.length) return innerRadiusCoef; innerRadiusCoef=v; return parliamentFunc; };
    parliamentFunc.enter = { 
        smallToBig(v){ if(!arguments.length) return enter.smallToBig; enter.smallToBig=v; return parliamentFunc.enter; },
        fromCenter(v){ if(!arguments.length) return enter.fromCenter; enter.fromCenter=v; return parliamentFunc.enter; }
    };
    parliamentFunc.update = { animate(v){ if(!arguments.length) return update.animate; update.animate=v; return parliamentFunc.update; } };
    parliamentFunc.exit = { 
        bigToSmall(v){ if(!arguments.length) return exit.bigToSmall; exit.bigToSmall=v; return parliamentFunc.exit; },
        toCenter(v){ if(!arguments.length) return exit.toCenter; exit.toCenter=v; return parliamentFunc.exit; }
    };
    parliamentFunc.on = (type, callback) => { dispatch.on(type, callback); };

    return parliamentFunc;
};
