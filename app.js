var app = angular.module('HealthApp', []);

app.controller('MainController', function($scope, $window, $http) {

    var API = 'https://digital-health-wallet-ysb8.onrender.com/api';

    function getToken() {
        return sessionStorage.getItem('authToken');
    }

    function authHeader() {
        return { headers: { 'Authorization': 'Bearer ' + getToken() } };
    }

    $scope.login = function() {
        $scope.errorMessage = '';
        $scope.loading = true;

        $http.post(API + '/login', {
            username: $scope.username,
            password: $scope.password
        })
        .then(function(response) {
            sessionStorage.setItem('authToken',  response.data.token);
            sessionStorage.setItem('doctorName', response.data.doctorName);
            sessionStorage.setItem('isLoggedIn', 'true');
            $window.location.href = 'doctor.html';
        })
        .catch(function(error) {
            $scope.errorMessage = error.data ? error.data.error : 'Login failed. Try again.';
        })
        .finally(function() {
            $scope.loading = false;
        });
    };

    $scope.checkAuth = function() {
        if (sessionStorage.getItem('isLoggedIn') !== 'true') {
            alert('Unauthorized access! Please login as a doctor.');
            $window.location.href = 'login.html';
        }
        $scope.currentDoctor = sessionStorage.getItem('doctorName');
    };

    $scope.registerPatient = function() {
        var aadharStr = String($scope.regAadhar || "");
        if (aadharStr.length !== 12) {
            $scope.regError = "Aadhar number must be exactly 12 digits.";
            return; 
        }
        var selectedDate = new Date($scope.regDob);
        var now = new Date();
        if (selectedDate > now) {
            $scope.regError = "Date of Birth cannot be in the future.";
            return;
        }
        $scope.regError   = '';
        $scope.regLoading = true;

        var patientData = {
            name:   $scope.regName,
            email:  $scope.regEmail,
            aadhar: $scope.regAadhar,
            dob:    $scope.regDob,
            gender: $scope.regGender,
            region: $scope.regRegion,
        };

        $http.post(API + '/patients/register', patientData)
        .then(function(response) {
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

    $scope.deleteRecord = function(recordId) {
        if (!confirm('Are you sure you want to delete this record? This cannot be undone.')) return;

        $http.delete(API + '/records/' + recordId, authHeader())
        .then(function() {
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

    $scope.displayUHID = localStorage.getItem('lastGeneratedUHID');

    $scope.logout = function() {
        var confirmLogout = confirm("Are you sure you want to sign out?");
        
        if (confirmLogout) {
            sessionStorage.clear();
            $window.location.href = 'login.html';
        } else {
            console.log("Logout cancelled by user.");
        }
    };

});
