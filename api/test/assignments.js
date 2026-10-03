/* eslint-disable indent */
//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

//Require the dev-dependencies
var server = require("../../sugarizer.js");
const chai = require('chai');
const chaiHttp = require('chai-http');
var timestamp = + new Date();

//fake user for testing authentication
var fake = {
    'student1': '{"name":"Sugarizer_1' + (timestamp.toString()) + '","color":{"stroke":"#FF0000","fill":"#0000FF"},"role":"student","password":"pass","language":"fr"}',
    'student2': '{"name":"Sugarizer_2' + (timestamp.toString()) + '","color":{"stroke":"#FF0000","fill":"#0000FF"},"role":"student","password":"word","language":"en"}',
    'admin': '{"name":"admin' + (timestamp.toString()) + '","password":"password","language":"en","role":"admin"}',
    'classroom1': '{"name":"group_a_' + (timestamp.toString()) + '","color":{"stroke":"#FF0000","fill":"#0000FF"},"students":[]}',
    'classroom2': '{"name":"group_b_' + (timestamp.toString()) + '","color":{"stroke":"#FF0000","fill":"#0000FF"},"students":[]}',
    'classroom3': '{"name":"group_a_' + (timestamp.toString()) + '","color":{"stroke":"#FF0000","fill":"#0000FF"},"students":[]}',
    'teacher1': '{"name":"SugarizerTeach_1' + (timestamp.toString()) + '","color":{"stroke":"#FF0000","fill":"#0000FF"},"role":"teacher","password":"bulbasaur","language":"fr"}',
    'teacher2': '{"name":"SugarizerTeach_2' + (timestamp.toString()) + '","color":{"stroke":"#FF0000","fill":"#0000FF"},"role":"teacher","password":"bulbasaur","language":"fr"}',
    'assignment1': '{"name":"assignment_1' + (timestamp.toString()) + '", "assignedWork":"ffffffff-ffff-ffff-ffff-fffffffffff1", "color":{"stroke":"#FF0000","fill":"#0000FF"},"instructions":"Draw a bulbasaur","lateTurnIn":"false","classrooms":[], "dueDate":"' + ((timestamp+3600000).toString()) + '"}',
    'assignment2': '{"name":"assignment_2' + (timestamp.toString()) + '", "assignedWork":"ffffffff-ffff-ffff-ffff-fffffffffff1", "color":{"stroke":"#FF0000","fill":"#0000FF"},"instructions":"Draw a pikachu","lateTurnIn":"true","classrooms":[], "dueDate":"' + ((timestamp+3600000).toString()) + '"}',
    'assignment3': '{"name":"assignment_1' + (timestamp.toString()) + '", "assignedWork":"ffffffff-ffff-ffff-ffff-fffffffffff1", "color":{"stroke":"#FF0000","fill":"#0000FF"},"instructions":"Draw a bulbasaur","lateTurnIn":"false","classrooms":[], "dueDate":"' + ((timestamp+3600000).toString()) + '"}',
    'delivery1': '{}',
};

//init server
chai.use(chaiHttp);
chai.should();

describe('Assignments', () => {

    //create & login user and store access key
    before((done) => {
        //delay for db connection for establish
        setTimeout(() => {
            chai.request(server)
                .post('/auth/signup')
                .send({
                    "user": fake.admin
                })
                .end(() => {
                    //login user
                    chai.request(server)
                        .post('/auth/login')
                        .send({
                            "user": fake.admin
                        })
                        .end((err, res) => {
                            //store user data
                            fake.admin = res.body;
                            //create fake user teachers and classrooms
                            chai.request(server)
                                .post('/api/v1/users/')
                                .set('x-access-token', fake.admin.token)
                                .set('x-key', fake.admin.user._id)
                                .send({
                                    "user": fake.student1
                                })
                                .end((err, res) => {
                                    fake.student1 = res.body;
                                    chai.request(server)
                                        .post('/api/v1/users/')
                                        .set('x-access-token', fake.admin.token)
                                        .set('x-key', fake.admin.user._id)
                                        .send({
                                            "user": fake.student2
                                        })
                                        .end((err, res) => {
                                            fake.student2 = res.body;
                                            //create classroom
                                            fake.classroom1 = JSON.parse(fake.classroom1);
                                            fake.classroom1.students.push(fake.student1._id);
                                            fake.classroom1.students.push(fake.student2._id);
                                            fake.classroom1 = JSON.stringify(fake.classroom1);
                                            chai.request(server)
                                                .post('/api/v1/classrooms/')
                                                .set('x-access-token', fake.admin.token)
                                                .set('x-key', fake.admin.user._id)
                                                .send({
                                                    "classroom": fake.classroom1
                                                })
                                                .end((err, res) => {
                                                    //store classroom data
                                                    fake.classroom1 = res.body;
                                                    chai.request(server)
                                                        .post('/api/v1/classrooms/')
                                                        .set('x-access-token', fake.admin.token)
                                                        .set('x-key', fake.admin.user._id)
                                                        .send({
                                                            classroom: fake.classroom2
                                                        })
                                                        .end((err, res) => {
                                                            fake.classroom2 = res.body;
                                                            chai.request(server)
                                                                .post('/api/v1/classrooms/')
                                                                .set('x-access-token', fake.admin.token)
                                                                .set('x-key', fake.admin.user._id)
                                                                .send({
                                                                    "classroom": fake.classroom3
                                                                })
                                                                .end((err, res) => {
                                                                    fake.classroom3 = res.body;
                                                                });
                                                        });
                                                });
                                            done();
                                        });
                                });
                        });
                });
        }, 300);
    });

    before((done) => {
        chai.request(server)
            .post('/api/v1/users/')
            .set('x-access-token', fake.admin.token)
            .set('x-key', fake.admin.user._id)
            .send({
                "user": fake.teacher1
            })
            .end(() => {
                chai.request(server)
                    .post('/auth/login')
                    .send({
                        "user": fake.teacher1
                    })
                    .end((err, res) => {
                        //teacher to classroom1
                        fake.teacher1 = res.body;
                        fake.teacher1.classrooms = [fake.classroom1._id];

                        chai.request(server)
                            .post('/api/v1/users/')
                            .set('x-access-token', fake.admin.token)
                            .set('x-key', fake.admin.user._id)
                            .send({
                                "user": fake.teacher2
                            })
                            .end(() => {
                                chai.request(server)
                                    .post('/auth/login')
                                    .send({
                                        "user": fake.teacher2
                                    })
                                    .end((err, res) => {
                                        fake.teacher2 = res.body;
                                        //add entry in journal
                                        var entry = genFakeJournalEntry(1);
                                        chai.request(server)
                                            .post('/api/v1/journal/' + fake.teacher1.user.private_journal)
                                            .set('x-access-token', fake.teacher1.token)
                                            .set('x-key', fake.teacher1.user._id)
                                            .send({
                                                "journal": entry
                                            })
                                            .end((err, res) => {
                                                res.should.have.status(200);
                                                res.body.should.be.deep.equal(JSON.parse(entry));
                                            });
                                        done();
                                    });
                            });
                    });
            });
    });
    //create fake assignment ---POST---
    describe('/POST assignment', () => {
        before((done) => {
            fake.assignment1 = JSON.parse(fake.assignment1);
            fake.assignment1.classrooms = [fake.classroom1._id, fake.classroom2._id];
            fake.assignment1 = JSON.stringify(fake.assignment1);
            done();
        });
        it('it should create an assignment', (done) => {
            chai.request(server)
                .post('/api/v1/assignments/')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .send({
                    "assignment": fake.assignment1
                })
                .end((err, res) => {
                    res.should.have.status(200);
                    fake.assignment1 = res.body;
                    res.body.should.be.an('object');
                    res.body.should.have.property('_id').not.eql(undefined);
                    res.body.should.have.property('name').eql("assignment_1" + (timestamp.toString()));
                    res.body.should.have.property('instructions').eql("Draw a bulbasaur");
                    done();
                });
        });
    });

    //get assignment ---GET/:id---
    describe('/GET/:id assignment', () => {
        it('it should return nothing on invalid', (done) => {
            chai.request(server)
                .get('/api/v1/assignments/' + 'xxx')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(401);
                    res.body.code.should.be.eql(35);
                    done();
                });
        });

        it('it should return nothing on inexisting id', (done) => {
            chai.request(server)
                .get('/api/v1/assignments/' + 'ffffffffffffffffffffffff')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(401);
                    res.body.code.should.be.eql(39);
                    done();
                });
        });

        it('it should return an assignment', (done) => {
            chai.request(server)
                .get('/api/v1/assignments/' + fake.assignment1._id)
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.be.an('object');
                    res.body.should.have.property('_id').eql(fake.assignment1._id);
                    res.body.should.have.property('name').eql("assignment_1" + (timestamp.toString()));
                    res.body.should.have.property('instructions').eql("Draw a bulbasaur");
                    res.body.should.have.property('lateTurnIn').eql(false);
                    res.body.should.have.property('classrooms').be.an('array');
                    done();
                });
        });
    });

    //lateTurnIn is a boolean and dueDate a number, whatever the API receives
    describe('/POST /PUT assignment value types', () => {
        var created = [];
        function post(fields, callback) {
            var assignment = JSON.parse('{"name":"types_' + (timestamp.toString()) + '","assignedWork":"ffffffff-ffff-ffff-ffff-fffffffffff1","instructions":"Types","classrooms":[]}');
            Object.assign(assignment, fields);
            chai.request(server)
                .post('/api/v1/assignments/')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .send({ "assignment": JSON.stringify(assignment) })
                .end((err, res) => {
                    if (res.body && res.body._id) {
                        created.push(res.body._id);
                    }
                    callback(res);
                });
        }
        function put(id, fields, callback) {
            chai.request(server)
                .put('/api/v1/assignments/' + id)
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .send({ assignment: JSON.stringify(fields) })
                .end((err, res) => callback(res));
        }
        function get(id, callback) {
            chai.request(server)
                .get('/api/v1/assignments/' + id)
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => callback(res));
        }
        var due = timestamp + 7200000;

        after((done) => {
            var next = () => {
                if (created.length == 0) {
                    return done();
                }
                chai.request(server)
                    .delete('/api/v1/assignments/' + created.shift())
                    .set('x-access-token', fake.teacher1.token)
                    .set('x-key', fake.teacher1.user._id)
                    .end(next);
            };
            next();
        });

        [['on', true], ['true', true], [true, true], ['off', false], ['false', false], [false, false]].forEach(([sent, stored]) => {
            it('it should store lateTurnIn ' + JSON.stringify(sent) + ' as the boolean ' + stored + ' on create', (done) => {
                post({ lateTurnIn: sent, dueDate: due }, (res) => {
                    res.should.have.status(200);
                    res.body.should.have.property('lateTurnIn').eql(stored);
                    get(res.body._id, (res) => {
                        res.body.should.have.property('lateTurnIn').eql(stored);
                        done();
                    });
                });
            });
        });

        it('it should store a boolean lateTurnIn on update', (done) => {
            post({ lateTurnIn: true, dueDate: due }, (res) => {
                var id = res.body._id;
                put(id, { lateTurnIn: 'on' }, (res) => {
                    res.should.have.status(200);
                    get(id, (res) => {
                        res.body.should.have.property('lateTurnIn').eql(true);
                        put(id, { lateTurnIn: 'false' }, (res) => {
                            res.should.have.status(200);
                            get(id, (res) => {
                                res.body.should.have.property('lateTurnIn').eql(false);
                                done();
                            });
                        });
                    });
                });
            });
        });

        it('it should reject an invalid lateTurnIn', (done) => {
            post({ lateTurnIn: 'maybe', dueDate: due }, (res) => {
                res.should.have.status(400);
                res.body.code.should.be.eql(43);
                done();
            });
        });

        it('it should store a numeric string dueDate as a number', (done) => {
            post({ lateTurnIn: false, dueDate: String(due) }, (res) => {
                res.should.have.status(200);
                res.body.should.have.property('dueDate').eql(due);
                var id = res.body._id;
                put(id, { dueDate: String(due + 1000) }, (res) => {
                    res.should.have.status(200);
                    get(id, (res) => {
                        res.body.should.have.property('dueDate').eql(due + 1000);
                        done();
                    });
                });
            });
        });

        it('it should keep a numeric dueDate', (done) => {
            post({ lateTurnIn: false, dueDate: due }, (res) => {
                res.should.have.status(200);
                res.body.should.have.property('dueDate').eql(due);
                done();
            });
        });

        ['tomorrow', '12abc', '', 'NaN', null, {}, true].forEach((bad) => {
            it('it should reject the dueDate ' + JSON.stringify(bad), (done) => {
                post({ lateTurnIn: false, dueDate: bad }, (res) => {
                    res.should.have.status(400);
                    res.body.code.should.be.eql(44);
                    done();
                });
            });
        });

        it('it should reject an invalid dueDate on update', (done) => {
            post({ lateTurnIn: false, dueDate: due }, (res) => {
                var id = res.body._id;
                put(id, { dueDate: 'soon' }, (res) => {
                    res.should.have.status(400);
                    res.body.code.should.be.eql(44);
                    get(id, (res) => {
                        res.body.should.have.property('dueDate').eql(due);
                        done();
                    });
                });
            });
        });
    });

    //get all assignments ---GET---
    describe('/GET assignments', () => {
        it('it should return all the assignments', (done) => {
            chai.request(server)
                .get('/api/v1/assignments')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.assignments.should.be.an('array');
                    res.body.assignments.length.should.be.above(0);
                    done();
                });
        });

        it('it should return all the fields for assignments', (done) => {
            chai.request(server)
                .get('/api/v1/assignments')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(200);
                    for (var i = 0; i < res.body.assignments.length; i++) {
                        res.body.assignments[i].should.be.an('object');
                        res.body.assignments[i].should.have.property('_id').not.eql(undefined);
                        res.body.assignments[i].should.have.property('name').not.eql(undefined);
                        res.body.assignments[i].should.have.property('instructions').not.eql(undefined);
                        res.body.assignments[i].should.have.property('lateTurnIn').not.eql(undefined);
                        res.body.assignments[i].should.have.property('dueDate').not.eql(undefined);
                        res.body.assignments[i].should.have.property('classrooms').be.an('array');
                    }
                    done();
                });
        });

        it('it should filter by name', (done) => {
            chai.request(server)
                .get('/api/v1/assignments?name=' + fake.assignment1.name)
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.assignments.length.should.be.above(0);
                    done();
                });
        });

        it('it should return nothing on fake name filtering', (done) => {
            chai.request(server)
                .get('/api/v1/assignments?name=' + "xxxx")
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.assignments.length.should.be.eql(0);
                    done();
                });
        });

        it('it should filter by created_by', (done) => {
            chai.request(server)
                .get('/api/v1/assignments?created_by=' + fake.assignment1.created_by)
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.assignments.length.should.be.above(0);
                    done();
                });
        });

        it('it should return nothing on fake created_by filtering', (done) => {
            chai.request(server)
                .get('/api/v1/assignments?created_by=' + 'ffffffffffffffffffffffff')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.assignments.length.should.be.eql(0);
                    done();
                });
        });
    });

    //update assignment ---PUT/:id---
    describe('/PUT/:id assignments', () => {
        before((done) => {
            chai.request(server)
                .post('/api/v1/assignments/')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .send({
                    "assignment": fake.assignment2
                })
                .end((err, res) => {
                    res.should.have.status(200);
                    fake.assignment2 = res.body;
                    res.body.should.be.an('object');
                    res.body.should.have.property('_id').not.eql(undefined);
                    res.body.should.have.property('name').eql("assignment_2" + (timestamp.toString()));
                    done();
                });
        });

        it('it should do nothing on invalid assignment', (done) => {
            chai.request(server)
                .put('/api/v1/assignments/' + 'invalid')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .send({
                    assignment: '{ "name": "assignment_2' + (timestamp.toString()) + '"}'
                })
                .end((err, res) => {
                    res.should.have.status(401);
                    res.body.code.should.be.eql(35);
                    done();
                });
        });

        it('it should do nothing on inexisting assignment', (done) => {
            chai.request(server)
                .put('/api/v1/assignments/' + 'ffffffffffffffffffffffff')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .send({
                    assignment: '{ "name": "assignment_new_a_' + (timestamp.toString()) + '"}'
                })
                .end((err, res) => {
                    res.should.have.status(401);
                    res.body.code.should.be.eql(40);
                    done();
                });
        });

        it('it should update the valid assignment', (done) => {
            chai.request(server)
                .put('/api/v1/assignments/' + fake.assignment1._id)
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .send({
                    assignment: '{ "name": "assignment_new_1' + (timestamp.toString()) + '"}'
                })
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.be.an('object');
                    res.body.should.have.property('id').eql(fake.assignment1._id);
                    done();
                });
        });
    });

    //lauch assignment ---POST/:id/launch---
    describe('/GET/:id launch assignment ', () => {

        it('it should do nothing on invalid assignment', (done) => {
            chai.request(server)
                .get('/api/v1/assignments/launch/' + 'invalid')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(401);
                    res.body.code.should.be.eql(35);
                    done();
                });
        });

        it('it should do nothing on inexisting assignment', (done) => {
            chai.request(server)
                .get('/api/v1/assignments/launch/' + 'ffffffffffffffffffffffff')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(401);
                    res.body.code.should.be.eql(39);
                    done();
                });
        });

        it('it should launch the valid assignment', (done) => {
            chai.request(server)
                .get('/api/v1/assignments/launch/' + fake.assignment1._id)
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(200);
                    fake.delivery1 = res.body;
                    res.body.should.be.an('object');
                    res.body.should.have.property('count').not.eql(0);
                    res.body.should.have.property('count').not.eql(undefined);
                    res.body.should.have.property('count').be.a('number');
                    done();
                });
        });
    });

    //get the deliveries of a launched assignment ---GET/deliveries/:id---
    describe('/GET/deliveries/:id assignment', () => {

        var firstOnPage = null;

        it('it should do nothing on invalid assignment', (done) => {
            chai.request(server)
                .get('/api/v1/assignments/deliveries/' + 'invalid')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(401);
                    res.body.code.should.be.eql(35);
                    done();
                });
        });

        it('it should return the deliveries of the launched assignment', (done) => {
            chai.request(server)
                .get('/api/v1/assignments/deliveries/' + fake.assignment1._id)
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.be.an('object');
                    // one delivery journal for each of the two students of the classroom
                    res.body.should.have.property('total').eql(2);
                    res.body.should.have.property('offset').eql(0);
                    res.body.should.have.property('limit').eql(10);
                    res.body.should.have.property('sort').eql('buddy_name(asc)');
                    res.body.should.have.property('links').be.an('object');
                    res.body.deliveries.should.be.an('array').with.lengthOf(2);
                    res.body.deliveries.forEach((delivery) => {
                        delivery.should.have.property('content').be.an('array').with.lengthOf(1);
                        delivery.content[0].metadata.should.have.property('assignmentId').eql(fake.assignment1._id);
                    });
                    done();
                });
        });

        it('it should paginate with limit and offset', (done) => {
            chai.request(server)
                .get('/api/v1/assignments/deliveries/' + fake.assignment1._id + '?limit=1&offset=0')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.have.property('total').eql(2);
                    res.body.should.have.property('offset').eql(0);
                    res.body.should.have.property('limit').eql(1);
                    res.body.deliveries.should.be.an('array').with.lengthOf(1);
                    res.body.links.should.have.property('next_page').eql('?limit=1&offset=1');
                    res.body.links.should.not.have.property('prev_page');
                    firstOnPage = res.body.deliveries[0]._id;
                    done();
                });
        });

        it('it should return the next page', (done) => {
            chai.request(server)
                .get('/api/v1/assignments/deliveries/' + fake.assignment1._id + '?limit=1&offset=1')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.have.property('total').eql(2);
                    res.body.should.have.property('offset').eql(1);
                    res.body.deliveries.should.be.an('array').with.lengthOf(1);
                    res.body.deliveries[0]._id.should.not.eql(firstOnPage);
                    res.body.links.should.have.property('prev_page').eql('?limit=1&offset=0');
                    res.body.links.should.not.have.property('next_page');
                    done();
                });
        });

        it('it should return nothing after the last delivery', (done) => {
            chai.request(server)
                .get('/api/v1/assignments/deliveries/' + fake.assignment1._id + '?limit=1&offset=2')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.have.property('total').eql(2);
                    res.body.deliveries.should.be.an('array').with.lengthOf(0);
                    done();
                });
        });

        // GET the deliveries of the launched assignment with a query string
        function getDeliveries(query, callback) {
            chai.request(server)
                .get('/api/v1/assignments/deliveries/' + fake.assignment1._id + query)
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end(callback);
        }
        function names(res) {
            return res.body.deliveries.map((delivery) => delivery.content[0].metadata.buddy_name);
        }

        it('it should filter the deliveries by buddy_name', (done) => {
            getDeliveries('', (err, res) => {
                var all = names(res);
                all.should.have.lengthOf(2);
                var wanted = all[1];
                getDeliveries('?buddy_name=' + encodeURIComponent(wanted), (err, res) => {
                    res.should.have.status(200);
                    res.body.should.have.property('total').eql(1);
                    names(res).should.eql([wanted]);
                    // partial and case insensitive
                    getDeliveries('?buddy_name=' + encodeURIComponent(wanted.toUpperCase()), (err, res) => {
                        res.body.should.have.property('total').eql(1);
                        names(res).should.eql([wanted]);
                        getDeliveries('?buddy_name=nobody_has_this_name', (err, res) => {
                            res.should.have.status(200);
                            res.body.should.have.property('total').eql(0);
                            res.body.deliveries.should.be.an('array').with.lengthOf(0);
                            done();
                        });
                    });
                });
            });
        });

        it('it should not break on a buddy_name that is not a valid regular expression', (done) => {
            getDeliveries('?buddy_name=' + encodeURIComponent('(['), (err, res) => {
                res.should.have.status(200);
                res.body.should.have.property('total').eql(0);
                done();
            });
        });

        it('it should apply the sort', (done) => {
            getDeliveries('?sort=' + encodeURIComponent('+buddy_name'), (err, res) => {
                res.should.have.status(200);
                res.body.should.have.property('sort').eql('buddy_name(asc)');
                var ascending = names(res);
                ascending.should.have.lengthOf(2);
                (ascending[0].toLowerCase() < ascending[1].toLowerCase()).should.eql(true);
                getDeliveries('?sort=-buddy_name', (err, res) => {
                    res.should.have.status(200);
                    res.body.should.have.property('sort').eql('buddy_name(desc)');
                    names(res).should.eql(ascending.slice().reverse());
                    // sorted before the pagination
                    getDeliveries('?sort=-buddy_name&limit=1', (err, res) => {
                        names(res).should.eql([ascending[1]]);
                        done();
                    });
                });
            });
        });

        it('it should use the default sort for an unknown sort field', (done) => {
            getDeliveries('?sort=-password', (err, res) => {
                res.should.have.status(200);
                res.body.should.have.property('sort').eql('buddy_name(desc)');
                res.body.deliveries.should.be.an('array').with.lengthOf(2);
                done();
            });
        });

        it('it should replace an invalid limit and offset by the default values', (done) => {
            var queries = ['?limit=0', '?limit=-3', '?limit=abc', '?offset=-1', '?offset=abc', '?limit=-1&offset=-1'];
            var next = () => {
                if (queries.length == 0) {
                    return done();
                }
                var query = queries.shift();
                getDeliveries(query, (err, res) => {
                    res.should.have.status(200, query);
                    res.body.should.have.property('limit').eql(10);
                    res.body.should.have.property('offset').eql(0);
                    res.body.deliveries.should.be.an('array').with.lengthOf(2);
                    res.body.links.should.not.have.property('prev_page');
                    res.body.links.should.not.have.property('next_page');
                    next();
                });
            };
            next();
        });

        it('it should keep the server up', (done) => {
            chai.request(server)
                .get('/api')
                .end((err, res) => {
                    res.should.have.status(200);
                    done();
                });
        });
    });

    // add comment to assignment ---POST/:id/comments---
    describe('/POST/:id/comments assignments', () => {

        it('it should do nothing on invalid assignment', (done) => {
            chai.request(server)
                .put('/api/v1/assignments/deliveries/comment/' + 'invalid?oid=' + fake.delivery1.objectId)
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .send({
                    comment: '{ "comment": "comment_"}'
                })
                .end((err, res) => {
                    res.should.have.status(401);
                    res.body.code.should.be.eql(35);
                    done();
                });
        });

        it('it should do nothing on comment with inexisting assignment and without oid', (done) => {
            chai.request(server)
                .put('/api/v1/assignments/deliveries/comment/' + 'ffffffffffffffffffffffff?oid=')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .send({
                    comment: '{ "comment": "comment_"}'
                })
                .end((err, res) => {
                    res.should.have.status(401);
                    res.body.code.should.be.eql(35);
                    done();
                });
        });

        it('it should do add comment in entry and with an valid oid and assignment id', (done) => {
            chai.request(server)
                .put('/api/v1/assignments/deliveries/comment/' + fake.assignment1._id + '?oid=' + fake.delivery1.objectId)
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .send({
                    comment: '{ "comment": "comment_"}'
                })
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.have.property('comment').eql("comment_");
                    done();
                });
        });
    });

    // submit assignment ---PUT/:id/submit---
    describe('/PUT/:id/submit assignments', () => {
        it('it should do nothing on invalid assignment', (done) => {
            chai.request(server)
                .put('/api/v1/assignments/deliveries/submit/' + 'invalid?oid=' + fake.delivery1.objectId)
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .send({
                    isSubmitted: true,
                    submissionDate: new Date()
                })
                .end((err, res) => {
                    res.should.have.status(401);
                    res.body.code.should.be.eql(35);
                    done();
                });
        });

        it('it should do nothing on submit with inexisting assignment and without oid', (done) => {
            chai.request(server)
                .put('/api/v1/assignments/deliveries/submit/' + 'ffffffffffffffffffffffff?oid=')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .send({
                    isSubmitted: true,
                    submissionDate: new Date()
                })
                .end((err, res) => {
                    res.should.have.status(401);
                    res.body.code.should.be.eql(35);
                    done();
                });
        });

        it('it should do submit with an valid oid and assignment id', (done) => {
            chai.request(server)
                .put('/api/v1/assignments/deliveries/submit/' + fake.assignment1._id + '?oid=' + fake.delivery1.objectId)
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .send({
                    isSubmitted: true,
                    submissionDate: new Date().getTime()
                })
                .end((err, res) => {
                    res.should.have.status(200);
                    done();
                });
        });
    });

    // return assignment ---GET/:id/return---
    describe('/GET/:id/return assignments', () => {
        it('it should do nothing on invalid assignment', (done) => {
            chai.request(server)
                .put('/api/v1/assignments/deliveries/return/' + 'invalid?oid=' + fake.delivery1.objectId)
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .send({
                    isSubmitted: false,

                })
                .end((err, res) => {
                    res.should.have.status(401);
                    res.body.code.should.be.eql(35);
                    done();
                });
        });

        it('it should do nothing on return with inexisting assignment and without oid', (done) => {
            chai.request(server)
                .put('/api/v1/assignments/deliveries/return/' + 'ffffffffffffffffffffffff?oid=')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .send({
                    isSubmitted: false,

                })
                .end((err, res) => {
                    res.should.have.status(401);
                    res.body.code.should.be.eql(35);
                    done();
                });
        });

        it('it should do return with an valid oid and assignment id', (done) => {
            chai.request(server)
                .put('/api/v1/assignments/deliveries/return/' + fake.assignment1._id + '?oid=' + fake.delivery1.objectId)
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .send({
                    isSubmitted: false,

                })
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.be.an('object');
                    done();
                });
        });
    });

    //delete assignment ---DELETE/:id---
    describe('/DELETE/:id assignments', () => {
        it('it should do nothing on invalid assignment', (done) => {
            chai.request(server)
                .delete('/api/v1/assignments/' + 'invalid')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(401);
                    res.body.code.should.be.eql(35);
                    done();
                });
        });

        it('it should do nothing on inexisting assignment', (done) => {
            chai.request(server)
                .delete('/api/v1/assignments/' + 'ffffffffffffffffffffffff')
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(401);
                    res.body.code.should.be.eql(40);
                    done();
                });
        });

        it('it should delete the valid assignment', (done) => {
            chai.request(server)
                .delete('/api/v1/assignments/' + fake.assignment1._id)
                .set('x-access-token', fake.teacher1.token)
                .set('x-key', fake.teacher1.user._id)
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.have.property('id').eql(fake.assignment1._id);
                    done();
                });
        });
    });


    //gen fake entries
    function genFakeJournalEntry(i, text) {
        var textValue;
        if (text === undefined || typeof text !== 'object') {
            textValue = "Entry_" + i.toString() + (text ? text : '');
        } else {
            textValue = text;
        }
        return JSON.stringify({
            "objectId": ("ffffffff-ffff-ffff-ffff-fffffffffff" + i.toString()),
            "text": textValue,
            "metadata": {
                'user_id': fake.teacher1.user._id,
                'keep': ((i % 2 == 0) ? 1 : undefined),
                'title': ((i % 2 == 0) ? 'title ' + i : 'eXTend ' + i),
                "timestamp": (+new Date() - parseInt(1000 * Math.random())),
                "activity": (i.toString() + ".mocha.org")
            }
        });
    }
});
