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
            // Force specific left-to-right party order
            // -----------------------------
            const partyOrder = ["raz","lew","po","pol","psl","pis","konf"];
            d.sort((a,b) => partyOrder.indexOf(a.id) - partyOrder.indexOf(b.id));

            // -----------------------------
            // Normalize seats to exactly 460
            // -----------------------------
            let totalSeatsRequested = d.reduce((sum,p)=>sum + p.seats,0);
            let scaledSeats = d.map(p => ({
                ...p,
                _scaledSeats: Math.floor(p.seats * 460 / totalSeatsRequested)
            }));
            let assigned = scaledSeats.reduce((sum,p)=>sum + p._scaledSeats,0);
            let leftover = 460 - assigned;
            for(let i=0; leftover>0; i++, leftover--){
                scaledSeats[i % scaledSeats.length]._scaledSeats++;
            }

            // -----------------------------
            // Compute number of rows
            // -----------------------------
            var totalSeats = 460;
            var nRows = 0, maxSeats = 0, b = 0.5;
            while(maxSeats < totalSeats) {
                nRows++;
                b += innerRadiusCoef / (1 - innerRadiusCoef);
                maxSeats = 0;
                for(var i=0;i<nRows;i++) maxSeats += Math.floor(Math.PI*(b+i));
            }

            var rowWidth = (outerR - innerR)/nRows;
            var seatsArr = [];
            var seatsToRemove = maxSeats - totalSeats;

            // -----------------------------
            // Generate seats in semicircle
            // -----------------------------
            for(var i=0;i<nRows;i++){
                var rowRadius = innerR + rowWidth*(i+0.5);
                var seatsInRow = Math.floor(Math.PI*(b+i)) - Math.floor(seatsToRemove/nRows) - (seatsToRemove%nRows > i ? 1:0);
                for(var j=0;j<seatsInRow;j++){
                    // Map j to theta linearly so that party positions are left-to-right along the row
                    var teta = -Math.PI + Math.PI * (j + 0.5)/seatsInRow;
                    seatsArr.push({
                        polar: { r: rowRadius, teta: teta },
                        cartesian: { x: rowRadius*Math.cos(teta), y: rowRadius*Math.sin(teta) }
                    });
                }
            }

            // -----------------------------
            // Assign parties left-to-right
            // -----------------------------
            // Outer rows first, then inward
            let seatCounter = 0;
            let partySeatsMap = {};
            scaledSeats.forEach(p => { partySeatsMap[p.id] = p._scaledSeats; });

            for(let row = nRows-1; row>=0; row--){
                let rowSeats = seatsArr.filter(s => Math.round((s.polar.r - innerR)/rowWidth) === row);
                let totalRowSeats = rowSeats.length;

                // Assign party seats proportionally along the row left-to-right
                let assignedRow = [];
                let remainingSeats = totalRowSeats;
                let activeParties = partyOrder.filter(pid => partySeatsMap[pid] > 0);
                let idx = 0;
                while(assignedRow.length < totalRowSeats){
                    activeParties.forEach(pid => {
                        if(partySeatsMap[pid] > 0 && assignedRow.length < totalRowSeats){
                            assignedRow.push(pid);
                            partySeatsMap[pid]--;
                        }
                    });
                    activeParties = partyOrder.filter(pid => partySeatsMap[pid] > 0);
                    idx++;
                    if(activeParties.length === 0) break;
                }

                // Assign to actual seat objects
                for(let s=0;s<rowSeats.length;s++){
                    let seat = rowSeats[s];
                    let pid = assignedRow[s];
                    seat.party = scaledSeats.find(p=>p.id===pid);
                }
            }

            // -----------------------------
            // Draw seats
            // -----------------------------
            var container = svg.select(".parliament");
            if(container.empty()) container = svg.append("g").classed("parliament", true);
            container.attr("transform","translate("+width/2+","+outerR+")");

            var circles = container.selectAll(".seat").data(seatsArr);
            circles.attr("class","seat");

            var circlesEnter = circles.enter().append("circle")
                .attr("class","seat")
                .attr("cx", enter.fromCenter ? 0 : d=>d.cartesian.x)
                .attr("cy", enter.fromCenter ? 0 : d=>d.cartesian.y)
                .attr("r", enter.smallToBig ? 0 : rowWidth*0.4)
                .attr("fill", d => d.party && d.party.color ? d.party.color : "#999")
                .attr("stroke","#333");

            if(enter.fromCenter || enter.smallToBig){
                var t = circlesEnter.transition().duration(1000);
                if(enter.fromCenter) t.attr("cx", d=>d.cartesian.x).attr("cy", d=>d.cartesian.y);
                if(enter.smallToBig) t.attr("r", rowWidth*0.4);
            }

            for(var evt in dispatch._){
                (function(evt){ circlesEnter.on(evt, function(e){ dispatch.call(evt,this,e); }); })(evt);
            }

            if(update.animate){
                circles.transition().duration(1000)
                    .attr("cx", d=>d.cartesian.x)
                    .attr("cy", d=>d.cartesian.y)
                    .attr("r", rowWidth*0.4)
                    .attr("fill", d => d.party && d.party.color ? d.party.color : "#999");
            } else {
                circles.attr("cx", d=>d.cartesian.x)
                       .attr("cy", d=>d.cartesian.y)
                       .attr("r", rowWidth*0.4)
                       .attr("fill", d => d.party && d.party.color ? d.party.color : "#999");
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
    parliamentFunc.on = function(type, callback){ dispatch.on(type, callback); };

    return parliamentFunc;
};

