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
        "click","dblclick","mousedown","mouseenter","mouseleave",
        "mousemove","mouseout","mouseover","mouseup",
        "touchcancel","touchend","touchmove","touchstart"
    );

    function parliamentFunc(data) {
        data.each(function(d) {
            width = width || this.getBoundingClientRect().width;
            height = width ? width / 2 : this.getBoundingClientRect().width / 2;
            var outerR = Math.min(width / 2, height);
            var innerR = outerR * innerRadiusCoef;
            var svg = d3.select(this);

            const totalSeats = 460;
            const partyOrder = ["raz","lew","po","pol","psl","pis","konf"];
            const orderedParties = partyOrder.map(pid => d.find(p=>p.id===pid)).filter(p=>p);

            // Scale seats to 460
            let totalRequested = orderedParties.reduce((sum,p)=>sum+p.seats,0);
            let scaledSeats = orderedParties.map(p=>({...p, _scaledSeats: Math.floor(p.seats*totalSeats/totalRequested)}));
            let assigned = scaledSeats.reduce((sum,p)=>sum+p._scaledSeats,0);
            let leftover = totalSeats - assigned;
            for(let i=0;i<leftover;i++) scaledSeats[i % scaledSeats.length]._scaledSeats++;

            // -----------------------------
            // Generate semicircle positions
            // -----------------------------
            let seatsArr = [];
            for(let i=0;i<totalSeats;i++){
                // polar coordinates along [-π, 0]
                let theta = -Math.PI + Math.PI*(i+0.5)/totalSeats;
                let radius = innerR + (outerR-innerR) * (1 - i/totalSeats); // optional: radial spread
                seatsArr.push({polar:{r:radius,teta:theta}, cartesian:{x:radius*Math.cos(theta), y:radius*Math.sin(theta)}});
            }

            // Assign parties sequentially
            let seatCounter = 0;
            scaledSeats.forEach(party=>{
                for(let s=0;s<party._scaledSeats;s++){
                    seatsArr[seatCounter].party = party;
                    seatCounter++;
                }
            });

            // -----------------------------
            // Draw seats
            // -----------------------------
            let container = svg.select(".parliament");
            if(container.empty()) container = svg.append("g").classed("parliament", true);
            container.attr("transform","translate("+width/2+","+outerR+")");

            let circles = container.selectAll(".seat").data(seatsArr);
            circles.enter().append("circle")
                .attr("class","seat")
                .attr("cx", enter.fromCenter?0:d=>d.cartesian.x)
                .attr("cy", enter.fromCenter?0:d=>d.cartesian.y)
                .attr("r", enter.smallToBig?0:(outerR-innerR)/40)
                .attr("fill", d=>d.party?d.party.color:"#999")
                .attr("stroke","#333")
                .merge(circles)
                .transition().duration(update.animate?1000:0)
                .attr("cx", d=>d.cartesian.x)
                .attr("cy", d=>d.cartesian.y)
                .attr("r",(outerR-innerR)/40)
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


             
