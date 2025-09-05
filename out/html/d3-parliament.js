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

    function parliamentFunc(selection) {
        selection.each(function(d) {
            // d is the array of party objects passed by caller
            var parties = d || [];
            width = width || this.getBoundingClientRect().width;
            height = width ? width / 2 : this.getBoundingClientRect().width / 2;

            var outerR = Math.min(width / 2, height);
            var innerR = outerR * innerRadiusCoef;

            var svg = d3.select(this);

            // -----------------------------
            // Compute layout rows for 460 seats
            // -----------------------------
            var TOTAL_SEATS = 460;
            var nRows = 0, maxSeats = 0, b = 0.5;
            while (maxSeats < TOTAL_SEATS) {
                nRows++;
                b += innerRadiusCoef / (1 - innerRadiusCoef);
                maxSeats = 0;
                for (var i = 0; i < nRows; i++) maxSeats += Math.floor(Math.PI * (b + i));
            }

            var rowWidth = (outerR - innerR) / nRows;
            var seatsArr = [];
            var seatsToRemove = maxSeats - TOTAL_SEATS;

            // -----------------------------
            // Create seats with semicircle layout (positions)
            // -----------------------------
            for (var row = 0; row < nRows; row++) {
                var rowRadius = innerR + rowWidth * (row + 0.5);
                var seatsInRow = Math.floor(Math.PI * (b + row))
                    - Math.floor(seatsToRemove / nRows)
                    - (seatsToRemove % nRows > row ? 1 : 0);
                var angleStep = Math.PI / seatsInRow;
                for (var j = 0; j < seatsInRow; j++) {
                    var theta = -Math.PI + angleStep * (j + 0.5);
                    seatsArr.push({
                        polar: { r: rowRadius, teta: theta },
                        cartesian: { x: rowRadius * Math.cos(theta), y: rowRadius * Math.sin(theta) }
                    });
                }
            }

            // seatsArr length should equal TOTAL_SEATS
            if (seatsArr.length !== TOTAL_SEATS) {
                console.warn("parliament: generated seatsArr length", seatsArr.length, "expected", TOTAL_SEATS);
            }

            // -----------------------------
            // Prepare party requested seats
            // -----------------------------
            console.log("parliament: incoming party objects:", parties);

            var requestedList = parties.map(function(p) {
                var req = 0;
                if (typeof p.seats === "number") req = Math.max(0, Math.floor(p.seats));
                else if (Array.isArray(p.seats)) req = p.seats.length;
                else req = 0;
                return {
                    party: p,
                    requested: req,
                    color: p && p.color ? p.color : null
                };
            });

            var totalRequested = requestedList.reduce(function(sum, item) { return sum + item.requested; }, 0);
            console.log("parliament: totalRequested seats (before scaling):", totalRequested);

            // -----------------------------
            // Scale to exactly TOTAL_SEATS using largest remainder (Hamilton)
            // -----------------------------
            if (totalRequested > 0) {
                // Compute quotas
                requestedList.forEach(function(item) {
                    item.quota = (item.requested * TOTAL_SEATS) / totalRequested;
                    item.floor = Math.floor(item.quota);
                    item.remainder = item.quota - item.floor;
                    item.assigned = item.floor;
                });

                var assignedSoFar = requestedList.reduce(function(s, it) { return s + it.assigned; }, 0);
                var leftover = TOTAL_SEATS - assignedSoFar;

                // Sort by remainder desc and break ties by requested desc then index
                requestedList.sort(function(a, b) {
                    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
                    if (b.requested !== a.requested) return b.requested - a.requested;
                    return 0;
                });

                for (var k = 0; k < leftover; k++) {
                    requestedList[k % requestedList.length].assigned++;
                }

                // restore original ordering (so assignment goes party-by-party as input)
                requestedList.sort(function(a, b) {
                    return parties.indexOf(a.party) - parties.indexOf(b.party);
                });
            } else {
                // Nothing requested — assign no seats to parties; seats will remain unassigned (grey)
                console.warn("parliament: totalRequested is 0 — no party seat requests. All seats will be unassigned (grey).");
                requestedList.forEach(function(item) { item.quota = 0; item.floor = 0; item.remainder = 0; item.assigned = 0; });
            }

            console.log("parliament: final scaled seat counts:", requestedList.map(function(it) {
                return { id: it.party && (it.party.id || it.party.name), requested: it.requested, assigned: it.assigned, color: it.color };
            }));

            // -----------------------------
            // Assign party objects to seat positions
            // -----------------------------
            var seatPosIndex = 0;
            // Fill seatsArr with party references (if assigned), otherwise leave party null
            requestedList.forEach(function(item) {
                var p = item.party;
                var a = item.assigned;
                for (var s = 0; s < a && seatPosIndex < seatsArr.length; s++) {
                    seatsArr[seatPosIndex].party = p;
                    seatsArr[seatPosIndex].data = null;
                    seatPosIndex++;
                }
            });
            // Any remaining seats are left unassigned (party = null)
            var unassigned = seatsArr.length - seatPosIndex;
            if (unassigned > 0) {
                console.log("parliament: unassigned seats remaining:", unassigned, "they will be rendered with fallback color.");
                for (; seatPosIndex < seatsArr.length; seatPosIndex++) {
                    seatsArr[seatPosIndex].party = null;
                    seatsArr[seatPosIndex].data = null;
                }
            }

            // Debug summary: count seats by party id/name
            var countByParty = {};
            seatsArr.forEach(function(s) {
                var key = s.party ? (s.party.id || s.party.name || "unknown") : "__unassigned";
                countByParty[key] = (countByParty[key] || 0) + 1;
            });
            console.log("parliament: seats by party after assignment:", countByParty);

            // -----------------------------
            // Draw seats
            // -----------------------------
            var container = svg.select(".parliament");
            if (container.empty()) container = svg.append("g").classed("parliament", true);
            container.attr("transform", "translate(" + (width / 2) + "," + outerR + ")");

            // DATA JOIN
            var circles = container.selectAll(".seat").data(seatsArr);
            // update existing
            circles.attr("class", "seat");

            // enter
            var circlesEnter = circles.enter().append("circle")
                .attr("class", "seat")
                .attr("cx", enter.fromCenter ? 0 : function(d) { return d.cartesian.x; })
                .attr("cy", enter.fromCenter ? 0 : function(d) { return d.cartesian.y; })
                .attr("r", enter.smallToBig ? 0 : rowWidth * 0.4)
                .attr("fill", function(d) {
                    if (!d.party) return "#999";
                    if (!d.party.color) {
                        console.warn("parliament: party missing .color:", d.party);
                        return "#999";
                    }
                    return d.party.color;
                })
                .attr("stroke", "#333");

            if (enter.fromCenter || enter.smallToBig) {
                var t = circlesEnter.transition().duration(1000);
                if (enter.fromCenter) t.attr("cx", function(d) { return d.cartesian.x; }).attr("cy", function(d) { return d.cartesian.y; });
                if (enter.smallToBig) t.attr("r", rowWidth * 0.4);
            }

            // attach events on enter selection
            for (var evt in dispatch._) {
                (function(evt) {
                    circlesEnter.on(evt, function(e) { dispatch.call(evt, this, e); });
                })(evt);
            }

            // update + animate
            if (update.animate) {
                circles.transition().duration(1000)
                    .attr("cx", function(d) { return d.cartesian.x; })
                    .attr("cy", function(d) { return d.cartesian.y; })
                    .attr("r", rowWidth * 0.4)
                    .attr("fill", function(d) {
                        if (!d.party) return "#999";
                        return d.party.color || "#999";
                    });
            } else {
                circles.attr("cx", function(d) { return d.cartesian.x; })
                    .attr("cy", function(d) { return d.cartesian.y; })
                    .attr("r", rowWidth * 0.4)
                    .attr("fill", function(d) { return d.party ? (d.party.color || "#999") : "#999"; });
            }

            // exit
            if (exit.toCenter || exit.bigToSmall) {
                circles.exit().transition().duration(1000)
                    .attr("cx", 0).attr("cy", 0)
                    .attr("r", 0)
                    .remove();
            } else {
                circles.exit().remove();
            }
        });
    }

    parliamentFunc.width = function(v){ if(!arguments.length) return width; width=v; return parliamentFunc; };
    parliamentFunc.height = function(v){ if(!arguments.length) return height; return parliamentFunc; };
    parliamentFunc.innerRadiusCoef = function(v){ if(!arguments.length) return innerRadiusCoef; innerRadiusCoef=v; return parliamentFunc; };

    parliamentFunc.enter = {
        smallToBig: function (value) {
            if (!arguments.length) return enter.smallToBig;
            enter.smallToBig = value;
            return parliamentFunc.enter;
        },
        fromCenter: function (value) {
            if (!arguments.length) return enter.fromCenter;
            enter.fromCenter = value;
            return parliamentFunc.enter;
        }
    };

    parliamentFunc.update = {
      animate: function(value) {
        if (!arguments.length) return update.animate;
        update.animate = value;
        return parliamentFunc.update;
      }
    };

    parliamentFunc.exit = {
        bigToSmall: function (value) {
            if (!arguments.length) return exit.bigToSmall;
            exit.bigToSmall = value;
            return parliamentFunc.exit;
        },
        toCenter: function (value) {
            if (!arguments.length) return exit.toCenter;
            exit.toCenter = value;
            return parliamentFunc.exit;
        }
    };

    parliamentFunc.on = function(type, callback) {
        dispatch.on(type, callback);
    };

    return parliamentFunc;

    function series(s,n){ var r=0; for (var i=0;i<=n;i++) r+=s(i); return r; }
};
