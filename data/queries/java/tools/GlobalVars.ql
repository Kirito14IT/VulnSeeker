import java

from Field f
where f.isStatic() and f.fromSource()
select f.getName() as var_name, f.getLocation().getFile().getAbsolutePath() as file, f.getLocation().getStartLine() as start_line
