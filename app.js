// app.js — Digital Health Wallet (Frontend)
// UPDATED: All data now comes from the backend API, not localStorage

var app = angular.module('HealthApp', []);

app.controller('MainController', function($scope, $window, $http) {

    // ── Base URL of your backend server ────────────────────────────────────
    // Change this to your deployed URL when you go live, e.g.:
    // var API = 'https://your-app.railway.app/api';
    var API = 'https://digital-health-wallet-production-fb20.up.railway.app';

    // ── Helper: get stored JWT token ────────────────────────────────────────
    function getToken() {
        return sessionStorage.getItem('authToken');
    }

    // ── Helper: build Authorization header ─────────────────────────────────
    function authHeader() {
        return { headers: { 'Authorization': 'Bearer ' + getToken() } };
    }


    // ────────────────────────────────────────────────────────────────────────
    // 1. DOCTOR LOGIN
    // Called from: login.html  (ng-submit="login()")
    // ────────────────────────────────────────────────────────────────────────
    $scope.login = function() {
        $scope.errorMessage = '';
        $scope.loading = true;

        $http.post(API + '/login', {
            username: $scope.username,
            password: $scope.password
        })
        .then(function(response) {
            // Save token and doctor name to sessionStorage
            sessionStorage.setItem('authToken',   response.data.token);
            sessionStorage.setItem('doctorName',  response.data.doctorName);
            sessionStorage.setItem('isLoggedIn',  'true');
            $window.location.href = 'doctor.html';
        })
        .catch(function(error) {
            $scope.errorMessage = error.data ? error.data.error : 'Login failed. Try again.';
        })
        .finally(function() {
            $scope.loading = false;
        });
    };


    // ────────────────────────────────────────────────────────────────────────
    // 2. AUTH CHECK (called on doctor.html load via ng-init)
    // ────────────────────────────────────────────────────────────────────────
    $scope.checkAuth = function() {
        if (sessionStorage.getItem('isLoggedIn') !== 'true') {
            alert('Unauthorized access! Please login as a doctor.');
            $window.location.href = 'login.html';
        }
        $scope.currentDoctor = sessionStorage.getItem('doctorName');
    };


    // ────────────────────────────────────────────────────────────────────────
    // 3. REGISTER PATIENT
    // Called from: client.html  (ng-submit="registerPatient()")
    // ────────────────────────────────────────────────────────────────────────
    $scope.registerPatient = function() {
        $scope.regError   = '';
        $scope.regLoading = true;

        var patientData = {
            name:   document.getElementById('name').value,
            email:  document.getElementById('email').value,
            aadhar: $scope.regAadhar,
            dob:    $scope.regDob,
            gender: $scope.regGender,
            region: $scope.regRegion,
        };

        $http.post(API + '/patients/register', patientData)
        .then(function(response) {
            // Store UHID for success page to display
            localStorage.setItem('lastGeneratedUHID', response.data.uhid);
            $window.location.href = 'registration_success.html';
        })
        .catch(function(error) {
            $scope.regError = error.data ? error.data.error : 'Registration failed. Try again.';
        })
        .finally(function() {
            $scope.regLoading = false;
        });
    };


    // ────────────────────────────────────────────────────────────────────────
    // 4. SEARCH PATIENT BY UHID
    // Called from: doctor.html  (ng-click="searchPatient()")
    // ────────────────────────────────────────────────────────────────────────
    $scope.searchPatient = function() {
        $scope.foundPatient = null;
        $scope.foundRecords = [];
        $scope.searchError  = '';

        if (!$scope.searchID) {
            $scope.searchError = 'Please enter a UHID.';
            return;
        }

        $http.get(API + '/records/' + $scope.searchID, authHeader())
        .then(function(response) {
            $scope.foundPatient = response.data.patient;
            $scope.foundRecords = response.data.records;
        })
        .catch(function(error) {
            if (error.status === 401 || error.status === 403) {
                alert('Session expired. Please login again.');
                $window.location.href = 'login.html';
            } else {
                $scope.searchError = error.data ? error.data.error : 'Search failed.';
            }
        });
    };


    // ────────────────────────────────────────────────────────────────────────
    // 5. ADD MEDICAL RECORD
    // Called from: add_record.html  (ng-submit="addRecord()")
    // ────────────────────────────────────────────────────────────────────────
    $scope.addRecord = function() {
        $scope.recordError   = '';
        $scope.recordLoading = true;

        var recordData = {
            uhid:          $scope.recUhid,
            symptoms:      $scope.recSymptoms,
            diagnosis:     $scope.recDiagnosis,
            prescriptions: $scope.recPrescriptions,
        };

        $http.post(API + '/records', recordData, authHeader())
        .then(function() {
            alert('Record added successfully!');
            $window.location.href = 'doctor.html';
        })
        .catch(function(error) {
            if (error.status === 401 || error.status === 403) {
                alert('Session expired. Please login again.');
                $window.location.href = 'login.html';
            } else {
                $scope.recordError = error.data ? error.data.error : 'Failed to add record.';
            }
        })
        .finally(function() {
            $scope.recordLoading = false;
        });
    };


    // ────────────────────────────────────────────────────────────────────────
    // 6. DELETE MEDICAL RECORD
    // Called from: doctor.html  (ng-click="deleteRecord(rec.id)")
    // ────────────────────────────────────────────────────────────────────────
    $scope.deleteRecord = function(recordId) {
        if (!confirm('Are you sure you want to delete this record? This cannot be undone.')) return;

        $http.delete(API + '/records/' + recordId, authHeader())
        .then(function() {
            // Remove from local array so table updates instantly without re-searching
            $scope.foundRecords = $scope.foundRecords.filter(function(r) {
                return r.id !== recordId;
            });
            alert('Record deleted successfully.');
        })
        .catch(function(error) {
            if (error.status === 401 || error.status === 403) {
                alert('Session expired. Please login again.');
                $window.location.href = 'login.html';
            } else {
                alert(error.data ? error.data.error : 'Failed to delete record.');
            }
        });
    };


    // ────────────────────────────────────────────────────────────────────────
    // 6. DISPLAY UHID ON SUCCESS PAGE
    // Called from: registration_success.html
    // ────────────────────────────────────────────────────────────────────────
    $scope.displayUHID = localStorage.getItem('lastGeneratedUHID');


    // ────────────────────────────────────────────────────────────────────────
    // 7. LOGOUT
    // ────────────────────────────────────────────────────────────────────────
    $scope.logout = function() {
        sessionStorage.clear();
        $window.location.href = 'login.html';
    };

});
