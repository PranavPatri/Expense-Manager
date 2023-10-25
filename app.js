const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const saltRounds = 8;
const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

mongoose.connect("mongodb+srv://admin-pranav:Test123@cluster0.yxvrl6g.mongodb.net/?retryWrites=true&w=majority/projectDB");

const userSchema = {
    username: String,
    password: String,
    friends: [ {friend: String, payable: {type: Number, default: 0}} ],
    groups: [ {groupid: String, payments: [{payername: String, amt: {type: Number, default: 0}}]} ]
};

const groupSchema = {
    _id: {type: String},
    groupname: String,
    members: [ {memberName: String, payableAmt: {type: Number, default: 0}} ],
    expenses: [ { description: String, amount: Number, equally: Boolean, paidby: String, membersInvolved: [ String ] }]
};

const User = mongoose.model("User", userSchema);
const Group = mongoose.model("Group", groupSchema);

var user;
var flag = true;
var acknowledgement = true;
var membersArray;
var groupName;
var groupsArray = [];
var tempArray;
var value;

app.get("/", function(req, res) {
    res.sendFile(__dirname + "/index.html");
})

app.get("/signup", function(req, res) {
    res.render("signup", {userExists: false});
});

app.post("/signup", async function(req, res) {
    try {
        user = req.body.name;
        const pwd = req.body.pwd;

        const foundUser = await User.findOne({ username: user });

        if (foundUser) {
            res.render("signup", { userExists: true });
        } else {
            const hash = await bcrypt.hash(pwd, saltRounds);

            const newUser = new User({
                username: user,
                password: hash
            });
            await newUser.save();

            const foundUser = await User.findOne({ username: user });

            if (foundUser && foundUser.groups.length !== 0) {
                const userGroups = foundUser.groups;

                for (const userGroup of userGroups) {
                    const group = await Group.findOne({ _id: userGroup.groupid });
                    console.log(group);
                    console.log(groupsArray);
                    if (group) {
                        groupsArray.push(group.groupname);
                    }
                }
            }

            res.redirect("/friends");
        }
    } catch (err) {
        console.log(err);
    }
});


app.get("/signin", function(req, res) {
    res.render("signin", {userExists: true});
});

app.post("/signin", function(req, res) {
    user = req.body.name;
    var pwd = req.body.pwd;

    User.findOne({username: user}).then(function(foundUser) {
        if(!foundUser)
            res.render("signin", {userExists: false});
        else {
            bcrypt.compare(pwd, foundUser.password, function(err, result) {
                if(result == true) {
                    res.redirect("/friends");
                } else {
                    res.render("signin", {userExists: false});
                }
            });
        }
    }).catch(function(err) {
        console.log(err);
    });


    groupsArray = [];
    User.findOne({username: user}).then(function(foundUser) {
        if(foundUser.groups.length !== 0) {
            const userGroups = foundUser.groups;
            userGroups.forEach(function(userGroup) {
                Group.findOne({_id: userGroup.groupid}).then(function(group) {
                    console.log(group);
                    console.log(groupsArray);
                    if(group)
                        groupsArray.push(group.groupname);
                }).catch(function(err) {
                    console.log(err);
                });
            });
        }
    }).catch(function(err) {
        console.log(err);
    });
});

app.get("/friends", function(req, res) {
    console.log(flag + " " + user);
    if(flag) {
        User.findOne({username: user}).then(function(foundUser) {
            if(foundUser)
                if(foundUser.friends.length === 0)
                    res.render("friends", {friends: foundUser.friends, userExists: flag, zeroLength: true, user: user})
                else
                    res.render("friends", {friends: foundUser.friends, userExists: flag, zeroLength: false, user: user})
        }).catch(function(err) {
            console.log(err);
        });
    } else{ console.log(flag)
        User.findOne({username: user}).then(function(foundFriend) {
            res.render("friends", {friends: foundFriend.friends, userExists: flag, zeroLength: foundFriend.length, user: user});
        });
    }
});

app.post("/friends", function(req, res) {
    const friend = req.body.friend;
    User.findOne({username: friend}).then(function(foundFriend) {
        if(foundFriend && foundFriend.username !== user) {
            flag = true;
            console.log("user "+user+" FoudFriend: "+foundFriend);
            User.findOneAndUpdate({username: user}, {$push: {friends: {friend: friend}}}/*, {$set: {_id: friend._id}}*/).then(function(updatedUser1) {
                console.log(updatedUser1);
                User.updateOne({username: friend}, {$push: {friends: {friend: user}}}/*, {$set: {_id: user._id}}*/).then(function(updatedUser2) {
                    console.log(updatedUser2);
                    res.redirect("/friends");
                })
            }).catch(function(err) {
                console.log(err);
            });
        } else {
            flag = false;
            res.redirect("/friends");
        }
    }).catch(function(err) {
        console.log(err);
    });
});

app.get("/groups", function(req, res) {
    if(groupsArray.length === 0)
        res.render("groups", {zeroLength: true, user: user});
    else
        res.render("groups", {groupNames: groupsArray, zeroLength: false, user: user});
});

var cnt=0;
app.post("/groups", function(req, res) {
    const group = req.body.group;
    // Create the group
    Group.create({groupname: group, _id: cnt++}).then(function(createdGroup) {
        console.log(createdGroup);
        const groupId = createdGroup._id;
        // Update the group with the member
        Group.updateOne({groupname: group}, {$push: {members: {memberName: user}}}).then(function(updatedMember) {
            console.log(updatedMember);
        })
         // Update the user with the group id
        User.updateOne({username: user}, {$push: {groups: {groupid: groupId}}}).then(function(updatedUser) {
            console.log(updatedUser);
        }).catch(function(err) {
            console.log(err);
        });
        groupsArray.push(group);
    }).catch(function(err) {
        console.log(err);
    });
    res.redirect("/groups");
});

app.get("/groups/:name", async function(req, res) {
    try {
        groupName = req.params.name;
        console.log("groupname:-> "+groupName);
        // Fetch membersArray
        const foundGroup = await Group.findOne({groupname: groupName});
        membersArray = foundGroup.members.map(member => member.memberName);
        tempArray=[];
        membersArray.forEach(function(tempMember) {
            tempArray.push(tempMember);
        });
        // Fetch expenses
        const expensesGroup = await Group.findOne({groupname: groupName});
        const expenses = expensesGroup.expenses;
        
        const usr = await User.findOne({username: user, 'groups.groupid': foundGroup._id});
        const grp = usr.groups.find(group => group.groupid === foundGroup._id);
        const userPayers = grp ? grp.payments : [];

        value = "";
        res.render("group", { transactions: expenses, user: user, groupName: groupName, userPayers: userPayers });
    } catch (err) {
        console.log(err);
        res.status(500).send("Internal Server Error");
    }
});


app.post("/groups/:name", function(req, res) {
    
});

app.get("/addMembers", function(req, res) {
    res.render("addMembers", {members: membersArray, acknowledged: acknowledgement, user: user, groupName: groupName});
});

app.post("/find", function(req, res) {
    let flagVal = 0;
    const member = req.body.member;
    if(membersArray.indexOf(member) < 0) {
        User.findOne({username: user}).then(function(foundUser) {
            foundUser.friends.forEach(function(foundFriend) {
                if(foundFriend.friend === member) {
                    flagVal = 1;
                    acknowledgement = true;
                    membersArray.push(member);
                    res.redirect("/addMembers");
                }
            });
        }).catch(function(err) {
            console.log(err);
        });
    }
    if(flagVal === 0) {
        acknowledgement = false;
        res.redirect("/addMembers");
    }
});

app.post("/delete", function(req, res) {
    const uncheckedMember = req.body.checkbox;
    const index = membersArray.indexOf(uncheckedMember);

    if(index !== -1) {
        Group.deleteOne({groupname: groupName, members: {memberName: uncheckedMember}}).then(function(err) {
            if(!err) console.log("Successfully deleted memberName from members array of groups collection");
        });
        membersArray.splice(index,1);
        res.redirect("/addMembers");
    }
});

// app.post("/addMembers", function(req, res) {
    // // Add members to groups collection from membersArray
    // let tempGroupId;
    // Group.findOneAndUpdate(
    //     { groupname: groupName },
    //     { $addToSet: { members: { $each: membersArray.map(member => ({ memberName: member })) } } },
    //     { upsert: true, returnDocument: 'after' }).then(function(updatedGroup) {
    //         console.log(updatedGroup);
    //     }).catch(function(err) {
    //         console.log(err);
    //     });
    // // Update payments to all uaers from members field of groups collection
    // let localFlag = 0;
    // for(let i = 0; i < membersArray.length; i++) {
    //     for(let j = 0; j < membersArray.length; j++) {
    //         if(i!==j) {
    //             User.findOne({username: membersArray[i]}).then(function(foundUser) {
    //                 foundUser.groups.forEach(function(group) {
    //                     if(group.groupid === tempGroupId) {
    //                         group.payements.forEach(function(payement) {
    //                             if(payement.payername === membersArray[j]) localFlag = 1;
    //                         })
    //                         if(localFlag === 0) {
    //                             User.findOneAndUpdate({username: membersArray[i]}, {$push: {groups: {groupid: tempGroupId, payements: {payername: membersArray[j]}}}}, {new: true}).then(function(updatedUser) {
    //                                 console.log(updatedUser);
    //                             }).catch(function(err) {
    //                                 console.log(err);
    //                             });
    //                         }
    //                     }
    //                 });
    //             }).catch(function(err) {
    //                 console.log(err);
    //             });
    //         }
    //         localFlag = 0;
    //     }
    // }
    // res.redirect("/groups/" + groupName);
// });

app.post("/addMembers", async function(req, res) {
    try {
        const group = await Group.findOne({ groupname: groupName });

        if (group) {
            // Extract member names from membersArray
            const membersObjects = membersArray.map(member => ({ memberName: member }));

            // Find existing member names in the group
            const existingMembers = group.members.map(member => member.memberName);

            // Filter out new members that are not already in the group
            const newMembers = membersObjects.filter(member => !existingMembers.includes(member.memberName));

            // Update the members array in the group document if there are new members
            if (newMembers.length > 0) {
                group.members = [...group.members, ...newMembers];
                
                // Save the updated group document
                await group.save();

                // Update groupid in users' groups array
                for (const member of newMembers) {
                    await User.updateOne(
                        { username: member.memberName },
                        { $addToSet: { groups: { groupid: group._id } } }
                    );
                }
            }

            // Extract payer names from membersArray
            const membersObjects1 = membersArray.map(payer => ({ payername: payer }));

            // Iterate over membersObjects1 array
            for (const payer of membersObjects1) {
                const user = await User.findOne({ username: payer.payername });
            
                // Find the group to update
                const groupToUpdate = user.groups.find(grp => grp.groupid == group._id);
            
                // Check if the groupToUpdate is found
                if (groupToUpdate) {
                    // Get existing payers for the specified groupid
                    const existingPayers = groupToUpdate.payments.map(payment => payment.payername);
            
                    // Filter out new payers that are not already in the payments
                    const newPayers = membersObjects1.filter(payment => !existingPayers.includes(payment.payername));
            
                    // Update the payments array in the user document if there are new payers
                    if (newPayers.length > 0) {
                        groupToUpdate.payments.push(...newPayers.map(payer => ({ payername: payer.payername, amt: 0 })));
            
                        // Save the updated user document
                        await user.save();
                    }
                } else {
                    // Handle the case where the group is not found
                    console.log(`Group with ID ${group._id} not found for user ${user.username}`);
                }
            }            

            // Redirect to the group page or any other appropriate page
            res.redirect("/groups/" + groupName);
        } else {
            // Handle error: Group not found
            res.status(404).send("Group not found");
        }
    } catch (err) {
        console.error(err);
        // Handle errors appropriately and send an error response if needed
        res.status(500).send("Internal Server Error");
    }
});

app.get("/expense", async function(req, res) {
    try {
        console.log("here tempArray "+tempArray);
        let newTempArray = membersArray.filter(element => !tempArray.includes(element));
        console.log("here newTempArray "+newTempArray);
        console.log("here membersArray "+membersArray);
        res.render("expense", {membersofGroup: membersArray, members: tempArray, otherMembers: newTempArray, value: value, user: user});
    } catch(err) {
        console.log(err);
    }
});

app.post("/deleteFromTemp", async function(req, res) {
    try {
        value = 'equally';
        const uncheckedMember = req.body.tempCheckbox;
        const index = tempArray.indexOf(uncheckedMember);
        console.log(index+" "+tempArray);

        if (index !== -1) {
            tempArray.splice(index, 1);
            console.log(tempArray);
            res.redirect("/expense");
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/addToTemp", async function(req, res) {
    try {
        value = 'equally';
        console.log("In Addtotemp");
        const checkedMember = req.body.otherCheckbox;
        tempArray.push(checkedMember);
    
        res.redirect("/expense");
    } catch(err) {
        console.log(err);
    }
});

app.post("/expense", function(req, res) {
    const desc = req.body.desc;
    var amt = parseInt(req.body.amt);
    const paidBy = req.body.paid;
    const divide = req.body.divide;
    
    console.log("Divide: "+divide);
    amt = amt/tempArray.length;

    Group.findOneAndUpdate({groupname: groupName}, {$push: {expenses: {description: desc, amount: amt*tempArray.length, equally: true, paidby: paidBy, membersInvolved: tempArray}}}).then(function(foundGroup) {
        let grpId = foundGroup._id;
        console.log("ID:.."+grpId);
        console.log("groupName: "+groupName);
        if(divide === "Equally") {
            tempArray.forEach(function(payer) {
                User.findOneAndUpdate(
                    { username: paidBy, 'groups.groupid': grpId, 'groups.payments.payername': payer },
                    { $inc: { 'groups.$[groupElem].payments.$[paymentElem].amt': amt } },
                    {
                        arrayFilters: [
                            { 'groupElem.groupid': grpId },
                            { 'paymentElem.payername': payer }
                        ],
                        new: true
                    }).then(updatedUser => {
                        console.log('User updated:', updatedUser);
                    })
                    .catch(err => {
                        console.error(err);
                        res.status(500).send("Internal Server Error");
                });

                // To carry global settlement to friend regardless of specific group. (+ve amts)
                User.findOneAndUpdate(
                    { username: paidBy, 'friends.friend': payer },
                    { $inc: { 'friends.$[elem].payable': amt } }, // Use '$' to refer to the matched element in the array
                    {
                        arrayFilters: [{ 'elem.friend': payer }], // Correct the arrayFilters syntax
                        new: true
                    }).then(updatedUser => {
                        console.log('User updated:', updatedUser);
                    })
                    .catch(err => {
                        console.error(err);
                        res.status(500).send("Internal Server Error");
                });

                User.findOneAndUpdate(
                    {username: payer, 'groups.groupid': grpId, 'groups.payments.payername': paidBy },
                    { $inc: { 'groups.$[groupElem].payments.$[paymentElem].amt': -amt } },
                    {
                        arrayFilters: [
                            { 'groupElem.groupid': grpId },
                            { 'paymentElem.payername': paidBy }
                        ],
                        new: true
                    }).then(updatedUser => {
                        console.log('User updated:', updatedUser);
                    })
                    .catch(err => {
                        console.error(err);
                        res.status(500).send("Internal Server Error");
                });

                // To carry global settlement to friend regardless of specific group. (-ve amts)
                User.findOneAndUpdate(
                    { username: payer, 'friends.friend': paidBy },
                    { $inc: { 'friends.$[elem].payable': -amt } }, // Use '$' to refer to the matched element in the array
                    {
                        arrayFilters: [{ 'elem.friend': paidBy }], // Correct the arrayFilters syntax
                        new: true
                    }).then(updatedUser => {
                        console.log('User updated:', updatedUser);
                    })
                    .catch(err => {
                        console.error(err);
                        res.status(500).send("Internal Server Error");
                });
            });
        }

    }).catch(function(err) {
        console.log(err);
    });

    res.redirect("/groups/" + groupName);
});

app.listen(process.env.PORT || 3000, function() {
    console.log("Server started at port 3000");
});