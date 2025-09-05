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


