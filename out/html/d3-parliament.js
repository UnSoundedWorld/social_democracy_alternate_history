/*
 * MIT License
 * © Copyright 2016 - Geoffrey Brossard (me@geoffreybrossard.fr)
 */

d3.parliament = function() {
    var width, height, innerRadiusCoef = 0.4;
    var enter = { smallToBig: true, fromCenter: true };
    var update = { animate: true };
    var exit = { bigToSmall: true, toCenter: true };
    var dispatch = d3.dispatch(
        "click","dblclick","mousedown","mouseenter","mouseleave","mousemove",
        "mouseout","mouseover","mouseup","touchcancel","touchend","touchmove","touchstart"
    );

    function parliamentFunc(data) {
        data.each(function(d) {
            width = width || this.getBoundingClientRect().width;
            height = width ? width / 2 : this.getBoundingClientRect().width / 2;

            var outerR = Math.min(width / 2, height);
            var innerR = outerR * innerRadiusCoef;
            var svg = d3.select(this);

            // -----------------------------
            // Compute rows
            // -----------------------------
            var totalSeats = 460;
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
            // Create seat positions (semicircle)
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
            // Assign parties left-to-right
            // -----------------------------
            // Custom party order for semicircle: leftmost -> rightmost
            const partyOrder = ["raz","lew","po","pol","psl","pis","konf"];
            const orderedParties = partyOrder.map(pid => d.find(p => p.id===pid)).filter(p=>p);
            const totalRequestedSeats = orderedParties.reduce((sum,p)=>sum+p.seats,0);

            // Scale seats to 460 total
            let scaledSeats = orderedParties.map(p=>({
                ...p,
                _scaledSeats: Math.floor(p.seats*totalSeats/totalRequestedSeats)
            }));
            let assigned = scaledSeats.reduce((sum,p)=>sum+p._scaledSeats,0);
            let leftover = totalSeats - assigned;
            let iLeft=0;
            while(leftover>0){
                scaledSeats[iLeft % scaledSeats.length]._scaledSeats++;
                leftover--; iLeft++;
            }

            // Assign seats to positions from left to right
            let seatCounter=0;
            scaledSeats.forEach(party=>{
                for(let s=0;s<party._scaledSeats;s++){
                    seatsArr[seatCounter].party = party;
                    seatCounter++;
                }
            });

            // -----------------------------
            // Draw seats
            // -----------------------------
            var container = svg.select(".parliament");
            if(container.empty()) container = svg.append("g").classed("parliament", true);
            container.attr("transform","translate("+width/2+","+outerR+")");

            var circles = container.selectAll(".seat").data(seatsArr);
            circles.enter().append("circle")
                .attr("class","seat")
                .attr("cx", enter.fromCenter?0:d=>d.cartesian.x)
                .attr("cy", enter.fromCenter?0:d=>d.cartesian.y)
                .attr("r", enter.smallToBig?0:rowWidth*0.4)
                .attr("fill", d=>d.party?d.party.color:"#999")
                .attr("stroke","#333")
                .merge(circles)
                .transition().duration(update.animate?1000:0)
                .attr("cx", d=>d.cartesian.x)
                .attr("cy", d=>d.cartesian.y)
                .attr("r", rowWidth*0.4)
                .attr("fill", d=>d.party?d.party.color:"#999");

            if(exit.toCenter || exit.bigToSmall){
                circles.exit().transition().duration(1000)
                    .attr("cx",0).attr("cy",0).attr("r",0)
                    .remove();
            } else circles.exit().remove();
        });
    }

    parliamentFunc.width = v=>{ if(!arguments.length) return width; width=v; return parliamentFunc; };
    parliamentFunc.height = v=>{ if(!arguments.length) return height; return parliamentFunc; };
    parliamentFunc.innerRadiusCoef = v=>{ if(!arguments.length) return innerRadiusCoef; innerRadiusCoef=v; return parliamentFunc; };
    parliamentFunc.enter = { smallToBig(v){ if(!arguments.length) return enter.smallToBig; enter.smallToBig=v; return parliamentFunc.enter; },
                             fromCenter(v){ if(!arguments.length) return enter.fromCenter; enter.fromCenter=v; return parliamentFunc.enter; }};
    parliamentFunc.update = { animate(v){ if(!arguments.length) return update.animate; update.animate=v; return parliamentFunc.update; }};
    parliamentFunc.exit = { bigToSmall(v){ if(!arguments.length) return exit.bigToSmall; exit.bigToSmall=v; return parliamentFunc.exit; },
                            toCenter(v){ if(!arguments.length) return exit.toCenter; exit.toCenter=v; return parliamentFunc.exit; }};
    parliamentFunc.on = (type,cb)=>dispatch.on(type,cb);

    return parliamentFunc;
};

