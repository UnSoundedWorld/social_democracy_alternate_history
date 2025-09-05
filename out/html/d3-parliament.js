/*
 * MIT License
 * © Copyright 2016 - Geoffrey Brossard (me@geoffreybrossard.fr)
 */

d3.parliament = function() {
    var width = 500,
        height = 250,
        innerRadiusCoef = 0.4;

    var enter = { smallToBig: true, fromCenter: true },
        update = { animate: true },
        exit = { bigToSmall: true, toCenter: true };

    var dispatch = d3.dispatch(
        "click","dblclick","mousedown","mouseenter",
        "mouseleave","mousemove","mouseout","mouseover",
        "mouseup","touchcancel","touchend","touchmove","touchstart"
    );

    function parliamentFunc(data) {
        data.each(function(d) {
            // Calculate outer and inner radius based on width/height
            var svg = d3.select(this);
            var outerR = Math.min(width/2, height);
            var innerR = outerR * innerRadiusCoef;

            // -----------------------------
            // Compute rows and total seats
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

            // -----------------------------
            // Normalize party seats
            // -----------------------------
            let totalRequested = d.reduce((sum,p)=>sum+p.seats,0);
            let scaled = d.map(p=>({...p, _scaledSeats: Math.floor(p.seats*totalSeats/totalRequested)}));
            let assigned = scaled.reduce((sum,p)=>sum+p._scaledSeats,0);
            let leftover = totalSeats - assigned;
            for(let i=0;i<leftover;i++) scaled[i%scaled.length]._scaledSeats++;

            // -----------------------------
            // Generate seat positions
            // -----------------------------
            let seatPositions = [];
            for(let row=0;row<nRows;row++){
                let rowRadius = innerR + rowWidth*(row+0.5);
                let seatsInRow = Math.floor(Math.PI*(b+row)) - Math.floor((maxSeats-totalSeats)/nRows) - ((maxSeats-totalSeats)%nRows > row ? 1:0);
                let angleStep = Math.PI/seatsInRow;
                for(let col=0;col<seatsInRow;col++){
                    seatPositions.push({
                        x: rowRadius*Math.cos(-Math.PI + angleStep*(col+0.5)),
                        y: rowRadius*Math.sin(-Math.PI + angleStep*(col+0.5))
                    });
                }
            }

            // -----------------------------
            // Assign parties left-to-right
            // -----------------------------
            const partyOrder = ["raz","lew","po","pol","psl","pis","konf"];
            let flatSeats = [];
            partyOrder.forEach(pid=>{
                let party = scaled.find(p=>p.id===pid);
                if(!party) return;
                for(let i=0;i<party._scaledSeats;i++) flatSeats.push(party);
            });
            seatPositions.forEach((seat,i)=>seat.party = flatSeats[i]);

            // -----------------------------
            // Draw seats
            // -----------------------------
            let container = svg.select(".parliament");
            if(container.empty()) container = svg.append("g").classed("parliament", true);
            container.attr("transform","translate("+width/2+","+outerR+")");

            let circles = container.selectAll(".seat").data(seatPositions);
            circles.exit().remove();

            let circlesEnter = circles.enter().append("circle")
                .attr("class","seat")
                .attr("cx", d=>d.x)
                .attr("cy", d=>d.y)
                .attr("r", rowWidth*0.4)
                .attr("fill", d=>d.party.color||"#999")
                .attr("stroke","#333");

            circles.merge(circlesEnter)
                .transition().duration(500)
                .attr("cx", d=>d.x)
                .attr("cy", d=>d.y)
                .attr("r", rowWidth*0.4)
                .attr("fill", d=>d.party.color||"#999");
        });
    }

    parliamentFunc.width = function(v){ if(!arguments.length) return width; width=v; return parliamentFunc; };
    parliamentFunc.height = function(v){ if(!arguments.length) return height; height=v; return parliamentFunc; };
    parliamentFunc.innerRadiusCoef = function(v){ if(!arguments.length) return innerRadiusCoef; innerRadiusCoef=v; return parliamentFunc; };
    parliamentFunc.on = function(type,callback){ dispatch.on(type,callback); };

    return parliamentFunc;
};
