/* поиск и выдача стабильных id сущностей (не индекс массива) */
export function findById(list, id){
  if (!list || id == null || id < 0) return null;
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

export function allocId(list){
  var m = -1;
  if (list) for (var i = 0; i < list.length; i++) if ((list[i].id|0) > m) m = list[i].id;
  return m + 1;
}
