/*
 * MIT License
 * © Copyright 2016 - Geoffrey Brossard (me@geoffreybrossard.fr)
 */

d3.parliament = function() {
    var width,
        height,
        innerRadiusCoef = 0.4;

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
            // Force party order left → right
            // -----------------------------
            const partyOrder = ["raz", "lew", "po", "pol", "psl", "pis", "konf"];
            d.sort((a, b) => partyOrder.indexOf(a.id) - partyOrder.indexOf(b.id));

            // -----------------------------
            // Compute seats and rows for 460-seat Sejm
            // -----------------------------
            var totalSeats = 460;
            var nRows = 0, maxSeats = 0, b = 0.5;
            while (maxSeats < totalSeats) {
                nRows++;
                b += innerRadiusCoef / (1 - innerRadiusCoef);
                maxSeats = 0;
                for (var i=0; i<nRows; i++) maxSeats += Math.floor(Math.PI * (b + i));
            }

            var rowWidth = (outerR - innerR) / nRows;
            var seatsArr = [];
            var seatsToRemove = maxSeats - totalSeats;

            // -----------------------------
            // Create seats with semicircle layout
            // -----------------------------
            for (var i=0; i<nRows; i++) {
                var rowRadius = innerR + rowWidth*(i+0.5);
                var seatsInRow = Math.floor(Math.PI*(b+i)) - Math.floor(seatsToRemove/nRows) - (seatsToRemove%nRows > i ? 1:0);
                var angleStep = Math.PI / seatsInRow;
                for (var j=0; j<seatsInRow; j++) {
                    seatsArr.push({
                        polar: { r: rowRadius, teta: -Math.PI + angleStep*(j+0.5) },
                        cartesian: { 
                            x: rowRadius*Math.cos(-Math.PI + angleStep*(j+0.5)), 
                            y: rowRadius*Math.sin(-Math.PI + angleStep*(j+0.5)) 
                        }
                    });
                }
            }

            // -----------------------------
            // Normalize party seats to exactly 460
            // -----------------------------
            let totalSeatsRequested = d.reduce((sum, p) => sum + p.seats, 0);
            let scaledSeats = d.map(p => ({
                ...p,
                _scaledSeats: Math.floor(p.seats * 460 / totalSeatsRequested)
            }));

            let assigned = scaledSeats.reduce((sum, p) => sum + p._scaledSeats, 0);
            let leftover = 460 - assigned;

            let idx = 0;
            while (leftover > 0) {
                scaledSeats[idx % scaledSeats.length]._scaledSeats++;
                leftover--;
                idx++;
            }

            // -----------------------------
            // Assign parties to seats
            // -----------------------------
            let seatCounter = 0;
            scaledSeats.forEach(party => {
                for (let s = 0; s < party._scaledSeats; s++) {
                    seatsArr[seatCounter].party = party;
                    seatCounter++;
                }
            });

            // DEBUG LOG
            console.log("Seats assigned to parties:", seatsArr);

            // -----------------------------
            // Draw seats
            // -----------------------------
            var container = svg.select(".parliament");
            if (container.empty()) container = svg.append("g").classed("parliament", true);

            // FIX: rotate whole chamber so order is left → right
            container.attr("transform", "translate(" + width/2 + "," + outerR + ") rotate(-90)");

            var circles = container.selectAll(".seat").data(seatsArr);
            circles.attr("class", "seat");

            var circlesEnter = circles.enter().append("circle")
                .attr("class","seat")
                .attr("cx", enter.fromCenter ? 0 : d=>d.cartesian.x)
                .attr("cy", enter.fromCenter ? 0 : d=>d.cartesian.y)
                .attr("r", enter.smallToBig ? 0 : rowWidth*0.4)
                .attr("fill", d => d.party.color || "#999")
                .attr("stroke", "#333");

            if (enter.fromCenter || enter.smallToBig) {
                var t = circlesEnter.transition().duration(1000);
                if (enter.fromCenter) t.attr("cx", d=>d.cartesian.x).attr("cy", d=>d.cartesian.y);
                if (enter.smallToBig) t.attr("r", rowWidth*0.4);
            }

            for (var evt in dispatch._) {
                (function(evt){ circlesEnter.on(evt, function(e){ dispatch.call(evt,this,e); }); })(evt);
            }

            if (update.animate) {
                circles.transition().duration(1000)
                    .attr("cx", d=>d.cartesian.x)
                    .attr("cy", d=>d.cartesian.y)
                    .attr("r", rowWidth*0.4)
                    .attr("fill", d=>d.party.color || "#999");
            } else {
                circles.attr("cx", d=>d.cartesian.x)
                       .attr("cy", d=>d.cartesian.y)
                       .attr("r", rowWidth*0.4)
                       .attr("fill", d=>d.party.color || "#999");
            }

            if (exit.toCenter || exit.bigToSmall) {
                circles.exit().transition().duration(1000)
                    .attr("cx",0).attr("cy",0)
                    .attr("r",0)
                    .remove();
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
