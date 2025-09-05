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

            var outerR = Math.min(width / 2, height);
            var innerR = outerR * innerRadiusCoef;

            var svg = d3.select(this);

            // -----------------------------
            // Normalize seats to 460
            // -----------------------------
            const totalSeats = 460;
            let totalRequested = d.reduce((sum, p) => sum + p.seats, 0);
            let scaled = d.map(p => ({
                ...p,
                _scaledSeats: Math.floor(p.seats * totalSeats / totalRequested)
            }));

            // Distribute leftover
            let assigned = scaled.reduce((sum, p) => sum + p._scaledSeats, 0);
            let leftover = totalSeats - assigned;
            let i = 0;
            while (leftover > 0) {
                scaled[i % scaled.length]._scaledSeats++;
                leftover--;
                i++;
            }

            // -----------------------------
            // Compute rows
            // -----------------------------
            var nRows = 0, maxSeats = 0, b = 0.5;
            while(maxSeats < totalSeats) {
                nRows++;
                b += innerRadiusCoef / (1 - innerRadiusCoef);
                maxSeats = 0;
                for(var r=0;r<nRows;r++) maxSeats += Math.floor(Math.PI*(b+r));
            }
            var rowWidth = (outerR - innerR)/nRows;

            // -----------------------------
            // Flatten seats in desired order
            // -----------------------------
            const partyOrder = ["raz","lew","po","pol","psl","pis","konf"];
            let flatSeats = [];
            partyOrder.forEach(pid => {
                let party = scaled.find(p=>p.id===pid);
                if (!party) return;
                for (let s=0; s<party._scaledSeats; s++) flatSeats.push(party);
            });

            // -----------------------------
            // Assign seats along semicircle
            // -----------------------------
            let seatsArr = [];
            let seatIndex = 0;
            for (let row=0; row<nRows; row++) {
                let rowRadius = innerR + rowWidth*(row+0.5);
                let seatsInRow = Math.floor(Math.PI*(b+row)) - Math.floor((maxSeats - totalSeats)/nRows) - ((maxSeats - totalSeats) % nRows > row ? 1:0);
                let angleStep = Math.PI / seatsInRow;
                for (let col=0; col<seatsInRow; col++) {
                    if (seatIndex >= flatSeats.length) break;
                    let theta = -Math.PI + angleStep*(col+0.5);
                    seatsArr.push({
                        polar: { r: rowRadius, teta: theta },
                        cartesian: { x: rowRadius*Math.cos(theta), y: rowRadius*Math.sin(theta) },
                        party: flatSeats[seatIndex]
                    });
                    seatIndex++;
                }
            }

            // -----------------------------
            // Draw seats
            // -----------------------------
            var container = svg.select(".parliament");
            if(container.empty()) container = svg.append("g").classed("parliament", true);
            container.attr("transform", "translate(" + width/2 + "," + outerR + ")");

            var circles = container.selectAll(".seat").data(seatsArr);
            circles.exit().remove();

            var circlesEnter = circles.enter().append("circle")
                .attr("class","seat")
                .attr("cx", enter.fromCenter ? 0 : d=>d.cartesian.x)
                .attr("cy", enter.fromCenter ? 0 : d=>d.cartesian.y)
                .attr("r", enter.smallToBig ? 0 : rowWidth*0.4)
                .attr("fill", d => d.party.color || "#999")
                .attr("stroke", "#333");

            if(enter.fromCenter || enter.smallToBig){
                var t = circlesEnter.transition().duration(1000);
                if(enter.fromCenter) t.attr("cx", d=>d.cartesian.x).attr("cy", d=>d.cartesian.y);
                if(enter.smallToBig) t.attr("r", rowWidth*0.4);
            }

            for(var evt in dispatch._){
                (function(evt){ circlesEnter.on(evt,function(e){ dispatch.call(evt,this,e); }); })(evt);
            }

            // Update existing
            circles.transition().duration(1000)
                .attr("cx", d=>d.cartesian.x)
                .attr("cy", d=>d.cartesian.y)
                .attr("r", rowWidth*0.4)
                .attr("fill", d=>d.party.color || "#999");
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

