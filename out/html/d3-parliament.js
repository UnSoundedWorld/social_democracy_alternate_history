/*
 * MIT License
 * © Copyright 2016 - Geoffrey Brossard (me@geoffreybrossard.fr)
 */

d3.parliament = function() {
    var width, height, innerRadiusCoef = 0.4;
    var enter = { smallToBig: true, fromCenter: true };
    var update = { animate: true };
    var exit = { bigToSmall: true, toCenter: true };
    var dispatch = d3.dispatch("click","dblclick","mousedown","mouseenter","mouseleave","mousemove","mouseout","mouseover","mouseup","touchcancel","touchend","touchmove","touchstart");

    function parliamentFunc(data) {
        data.each(function(d) {
            width = width || this.getBoundingClientRect().width;
            height = width ? width / 2 : this.getBoundingClientRect().width / 2;

            var outerR = Math.min(width/2,height);
            var innerR = outerR*innerRadiusCoef;
            var svg = d3.select(this);

            // -----------------------------
            // Party order: left->right on semicircle
            // -----------------------------
            const partyOrder = ["raz","lew","po","pol","psl","pis","konf"];
            const orderedParties = partyOrder.map(pid => d.find(p=>p.id===pid)).filter(p=>p);

            // -----------------------------
            // Scale party seats to total 460
            // -----------------------------
            let totalSeatsRequested = orderedParties.reduce((sum,p)=>sum+p.seats,0);
            let scaledSeats = orderedParties.map(p=>({
                ...p,
                _scaledSeats: Math.floor(p.seats*460/totalSeatsRequested)
            }));
            let assigned = scaledSeats.reduce((sum,p)=>sum+p._scaledSeats,0);
            let leftover = 460 - assigned;
            for(let i=0;i<leftover;i++){
                scaledSeats[i%scaledSeats.length]._scaledSeats++;
            }

            // -----------------------------
            // Create semicircle seats positions
            // -----------------------------
            let seatsArr = [];
            let rows = Math.ceil(Math.sqrt(460)); // rough number of rows
            let seatCounter = 0;
            for(let r=0;r<rows;r++){
                let rowRadius = innerR + r*(outerR-innerR)/rows + (outerR-innerR)/(2*rows);
                let seatsInRow = Math.round(Math.PI*(r+1)); // approximate
                for(let s=0;s<seatsInRow && seatCounter<460;s++){
                    let angle = -Math.PI + Math.PI*(s+0.5)/seatsInRow;
                    seatsArr.push({ 
                        polar:{r:rowRadius,teta:angle},
                        cartesian:{x:rowRadius*Math.cos(angle),y:rowRadius*Math.sin(angle)}
                    });
                    seatCounter++;
                }
            }

            // -----------------------------
            // Assign parties left->right
            // -----------------------------
            seatCounter=0;
            scaledSeats.forEach(party=>{
                for(let s=0;s<party._scaledSeats;s++){
                    seatsArr[seatCounter].party = party;
                    seatCounter++;
                }
            });

            // -----------------------------
            // Draw seats
            // -----------------------
