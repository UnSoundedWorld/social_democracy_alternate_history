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
            // Generate seats in semicircle (inner -> outer)
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
            // Assign parties left-to-right as contiguous blocks per row
            // Outer rows first, then inward (so blocks wrap nicely)
            // -----------------------------
            // Build mutable map of remaining seats per party
            let partySeatsMap = {};
            scaledSeats.forEach(p => { partySeatsMap[p.id] = p._scaledSeats; });

            // helper: allocate contiguous seats for a row using proportional shares + fractional remainder
            function allocateRowSeats(remainingMap, totalRowSeats, order) {
                const remainingTotal = Object.keys(remainingMap).reduce((s,k)=> s + Math.max(0, remainingMap[k]), 0);
                let desired = {};
                if (remainingTotal <= 0) {
                    // no more seats anywhere
                    order.forEach(pid => desired[pid] = 0);
                    return desired;
                }
                // initial floor allocation based on share
                let sumAllocated = 0;
                order.forEach(pid => {
                    if (remainingMap[pid] > 0) {
                        let share = remainingMap[pid] / remainingTotal;
                        let alloc = Math.floor(share * totalRowSeats);
                        alloc = Math.min(alloc, remainingMap[pid]); // can't allocate more than remaining for that party
                        desired[pid] = alloc;
                        sumAllocated += alloc;
                    } else {
                        desired[pid] = 0;
                    }
                });
                let leftoverSeats = totalRowSeats - sumAllocated;

                // compute fractional remainders to fairly assign leftover seats
                let remainders = order.map(pid => {
                    if (remainingMap[pid] > 0) {
                        let share = remainingMap[pid] / remainingTotal;
                        let exact = share * totalRowSeats;
                        let frac = exact - Math.floor(exact);
                        return { pid: pid, frac: frac };
                    } else return { pid: pid, frac: -1 };
                }).sort((a,b) => b.frac - a.frac); // biggest fractional remainder first

                // assign leftovers to highest fractional remainder parties (but never exceed that party's remaining seats)
                for(let k=0; k<remainders.length && leftoverSeats>0; k++){
                    const pid = remainders[k].pid;
                    if (pid && remainingMap[pid] > desired[pid]) {
                        desired[pid]++;
                        leftoverSeats--;
                    }
                }

                // if still leftover (rare), assign left-to-right to parties with remaining seats
                if (leftoverSeats > 0){
                    for(let k=0;k<order.length && leftoverSeats>0;k++){
                        const pid = order[k];
                        if (remainingMap[pid] > desired[pid]) {
                            desired[pid]++;
                            leftoverSeats--;
                        }
                    }
                }

                // Final clamp just in case
                order.forEach(pid => {
                    desired[pid] = Math.min(desired[pid], remainingMap[pid]);
                });

                // If for numeric reasons we didn't fill the row fully, fill from left-to-right available parties
                let finalSum = order.reduce((s,pid)=> s + desired[pid], 0);
                let idx = 0;
                while(finalSum < totalRowSeats) {
                    const pid = order[idx % order.length];
                    if (remainingMap[pid] > desired[pid]) {
                        desired[pid]++; finalSum++;
                    }
                    idx++;
                    // if we looped too many times and can't fill (shouldn't happen), break
                    if (idx > order.length * 10) break;
                }

                return desired;
            }

            // We'll need seats grouped by row index
            function rowIndexForSeat(s) {
                return Math.round((s.polar.r - innerR)/rowWidth);
            }

            // iterate rows from outermost to innermost
            for(let row = nRows-1; row>=0; row--){
                // collect seats for this row in their left-to-right angular order
                let rowSeats = seatsArr.filter(s => rowIndexForSeat(s) === row);
                // they are already in j-increment order but let's be safe and sort by theta
                rowSeats.sort((a,b) => a.polar.teta - b.polar.teta);

                let totalRowSeats = rowSeats.length;
                if (totalRowSeats === 0) continue;

                // build desired allocation for this row
                let desired = allocateRowSeats(partySeatsMap, totalRowSeats, partyOrder);

                // build assignedRow as contiguous blocks (left to right)
                let assignedRow = [];
                partyOrder.forEach(pid => {
                    let count = desired[pid] || 0;
                    for(let c=0;c<count;c++) assignedRow.push(pid);
                });

                // if assignedRow length differs due to any rounding, adjust by trimming or padding left-to-right
                if (assignedRow.length > totalRowSeats) assignedRow = assignedRow.slice(0, totalRowSeats);
                while(assignedRow.length < totalRowSeats) {
                    // find first party with remaining seats and append
                    let appended = false;
                    for(let p=0;p<partyOrder.length;p++){
                        let pid = partyOrder[p];
                        if ((partySeatsMap[pid] || 0) > (desired[pid] || 0)) {
                            assignedRow.push(pid);
                            desired[pid] = (desired[pid]||0) + 1;
                            appended = true;
                            break;
                        }
                    }
                    if (!appended) {
                        // fallback: append last party
                        assignedRow.push(partyOrder[partyOrder.length-1]);
                    }
                }

                // Assign to actual seat objects and decrement global remaining seat counters
                for(let s=0;s<rowSeats.length;s++){
                    let seat = rowSeats[s];
                    let pid = assignedRow[s];
                    let pObj = scaledSeats.find(p=>p.id===pid);
                    seat.party = pObj;
                    partySeatsMap[pid] = Math.max(0, (partySeatsMap[pid] || 0) - 1);
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
