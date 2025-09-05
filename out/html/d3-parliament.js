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
            // Compute seats and rows for 460-seat Sejm
            // -----------------------------
            var totalSeats = 460; // fixed Sejm seats
            var nRows = 0, maxSeats = 0, b = 0.5;
            while(maxSeats < totalSeats) {
                nRows++;
                b += innerRadiusCoef / (1 - innerRadiusCoef);
                maxSeats = 0;
                for(var i=0;i<nRows;i++) maxSeats += Math.floor(Math.PI * (b + i));
            }

            var rowWidth = (outerR - innerR) / nRows;
            var seatsArr = [];
            var seatsToRemove = maxSeats - totalSeats;

            // -----------------------------
            // Create seats with semicircle layout
            // -----------------------------
            for(var i=0;i<nRows;i++){
                var rowRadius = innerR + rowWidth*(i+0.5);
                var seatsInRow = Math.floor(Math.PI*(b+i)) - Math.floor(seatsToRemove/nRows) - (seatsToRemove%nRows > i ? 1:0);
                var angleStep = Math.PI / seatsInRow;
                for(var j=0;j<seatsInRow;j++){
                    seatsArr.push({
                        polar: { r: rowRadius, teta: -Math.PI + angleStep*(j+0.5) },
                        cartesian: { x: rowRadius*Math.cos(-Math.PI + angleStep*(j+0.5)), y: rowRadius*Math.sin(-Math.PI + angleStep*(j+0.5)) }
                    });
                }
            }

            // -----------------------------
            // Assign party data to seats proportionally
            // -----------------------------
           /* fill the seat objects with data of its party and of itself if existing */
            (function() {
                var partyIndex = 0;
                var seatIndex = 0;
                seats.forEach(function(s) {
                    /* get current party and go to the next one if it has all its seats filled */
                    var party = d[partyIndex];
                    var nSeatsInParty = typeof party.seats === 'number' ? party.seats : party.seats.length;
                    if (seatIndex >= nSeatsInParty) {
                        partyIndex++;
                        seatIndex = 0;
                        party = d[partyIndex];
                    }

                    /* set party data */
                    s.party = party;
                    s.data = typeof party.seats === 'number' ? null : party.seats[seatIndex];

                    seatIndex++;
                });
            })();
                // DEBUG LOG: show which seat belongs to which party and its color
                console.log(`Seat ${i}: Party=${party.id || party.name}, Seats=${party.seats}, Color=${party.color}`);
            });

            console.log("Final seats assignment:", seatsArr);

            // -----------------------------
            // Draw seats
            // -----------------------------
            var container = svg.select(".parliament");
            if(container.empty()) container = svg.append("g").classed("parliament", true);
            container.attr("transform", "translate(" + width/2 + "," + outerR + ")");

            var circles = container.selectAll(".seat").data(seatsArr);
            circles.attr("class", "seat");

            var circlesEnter = circles.enter().append("circle")
                .attr("class","seat")
                .attr("cx", enter.fromCenter?0:d=>d.cartesian.x)
                .attr("cy", enter.fromCenter?0:d=>d.cartesian.y)
                .attr("r", enter.smallToBig?0:rowWidth*0.4)
                .attr("fill", d=>{
                    if(!d.party || !d.party.color){
                        console.warn("Missing color for seat:", d);
                        return "#999"; // fallback
                    }
                    return d.party.color;
                })
                .attr("stroke", "#333");

            if(enter.fromCenter || enter.smallToBig){
                var t = circlesEnter.transition().duration(1000);
                if(enter.fromCenter) t.attr("cx", d=>d.cartesian.x).attr("cy", d=>d.cartesian.y);
                if(enter.smallToBig) t.attr("r", rowWidth*0.4);
            }

            // Attach events
            for(var evt in dispatch._){
                (function(evt){ circlesEnter.on(evt, function(e){ dispatch.call(evt,this,e); }); })(evt);
            }

            // Update
            if(update.animate){
                circles.transition().duration(1000)
                    .attr("cx", d=>d.cartesian.x)
                    .attr("cy", d=>d.cartesian.y)
                    .attr("r", rowWidth*0.4)
                    .attr("fill", d=>{
                        if(!d.party || !d.party.color){
                            console.warn("Missing color (update) for seat:", d);
                            return "#999";
                        }
                        return d.party.color;
                    });
            } else {
                circles.attr("cx", d=>d.cartesian.x)
                       .attr("cy", d=>d.cartesian.y)
                       .attr("r", rowWidth*0.4)
                       .attr("fill", d=>{
                           if(!d.party || !d.party.color){
                               console.warn("Missing color (update) for seat:", d);
                               return "#999";
                           }
                           return d.party.color;
                       });
            }

            // Exit
            if(exit.toCenter || exit.bigToSmall){
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

    function series(s,n){ var r=0; for(var i=0;i<=n;i++) r+=s(i); return r; }
};
