const gulp = require('gulp');
const gzip = require('gulp-gzip');

gulp.task('compress', function () {
  return gulp
    .src(['./dist/cs_ng_app_client/*.*'])
    .pipe(gzip())
    .pipe(gulp.dest('./dist/cs_ng_app_client'));
});
